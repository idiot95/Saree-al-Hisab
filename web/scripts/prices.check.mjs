#!/usr/bin/env node
/* ensureRates against the real database: the second call within 24 h makes no
 * fetch, a failed provider leaves the base stale without throwing, and
 * holding_value values a USD pot from the fetched quote.
 *
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/prices.check.mjs
 *
 * src/db/prices.ts is bundled as written (esbuild); only its './client' is
 * swapped for the owner connection, and 'server-only' for nothing. Fetch is
 * injected, so no network is needed and the call count is exact. Run without
 * DATABASE_URL in the environment; the URL comes from .env.local.          */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postgres from 'postgres';
import { localOwnerUrl, assertLocal } from './local-only.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = process.env.DATABASE_URL
  ?? /^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1]
  ?? /^DATABASE_URL="?([^"\n]+)/m.exec(envFile)[1];
assertLocal(url);
localOwnerUrl(root);
const sql = postgres(url, { ssl: 'require', max: 2, onnotice: () => {} });
globalThis.__checkSql = sql;

const out = join(mkdtempSync(join(tmpdir(), 'prices-')), 'prices.mjs');
await build({
  entryPoints: [join(root, 'src/db/prices.ts')], bundle: true, format: 'esm', platform: 'node',
  outfile: out, logLevel: 'error', external: ['postgres'],
  alias: { '@': join(root, 'src') },
  plugins: [{ name: 'stubs', setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'so', namespace: 'stub' }));
    b.onResolve({ filter: /^\.\/client$/ }, () => ({ path: 'client', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (a) => ({
      contents: a.path === 'so' ? '' : 'export const identity = globalThis.__checkSql;',
      loader: 'js',
    }));
  } }],
});
/* The failure memo (15 minutes per provider and quote) is module state with no reset exported, as it should be in
   production. A fresh instance of the module is a fresh memo: ESM caches by URL, so a new query string evaluates the
   bundle again. Each step that needs a clean slate takes one. */
let instance = 0;
let ensureRates;
const freshModule = async () => { ({ ensureRates } = await import(`${pathToFileURL(out).href}?i=${++instance}`)); };
await freshModule();

let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else fail++; console.log(`  ${c ? 'ok  ' : 'FAIL'} ${what}`); };

const erApi = (usd) => ({ result: 'success', time_last_update_unix: Math.floor(Date.now() / 1000) - 3600,
  base_code: 'MVR', rates: { MVR: 1, USD: usd, AED: 0.04375 } });
const gold = (p) => ({ currency: 'USD', price: p, symbol: 'XAU', updatedAt: new Date(Date.now() - 60000).toISOString() });
function fakeFetch(handlers) {
  const calls = [];
  const f = async (u) => {
    calls.push(String(u));
    const h = handlers[new URL(String(u)).pathname];
    if (h === 'fail') throw Object.assign(new Error('nope'), { name: 'TimeoutError' });
    return new Response(JSON.stringify(h), { status: 200 });
  };
  f.calls = calls; return f;
}

// A real currency no fixture household uses (the quote must pass isCurrency); cleaned by (quote, source).
const Q = 'MVR', clean = () => sql`delete from price_quote where quote = ${Q} and source = 'api'`;
await clean();
try {
  const f1 = fakeFetch({ '/v6/latest/MVR': erApi(0.0125), '/price/XAU': gold(3110.34768) });
  const r1 = await ensureRates('h', ['USD', 'AED', 'XAU'], Q, f1);
  ok(r1.stale.length === 0, `first call fetches and nothing is stale (${JSON.stringify(r1.stale)})`);
  ok(f1.calls.length === 2, `one FX call for the quote + one per metal, not per base (${f1.calls.length})`);
  const rows = await sql`select base, rate::text, source, fetched_at > now() - interval '1 minute' as fresh, as_of from price_quote where quote = ${Q} order by base`;
  ok(rows.map((x) => x.base).join() === 'AED,USD,XAU', 'three quotes stored');
  ok(rows.every((x) => x.source === 'api' && x.fresh), "source 'api', fetched_at now()");
  ok(rows.find((x) => x.base === 'USD').rate === '80.0000000000', 'USD/MVR = 1/0.0125');
  ok(rows.find((x) => x.base === 'XAU').rate === '8000.0000000000', 'XAU per gram = 3110.34768 oz-price/31.1034768 x 80 = 8000');

  const f2 = fakeFetch({});
  const r2 = await ensureRates('h', ['USD', 'AED', 'XAU'], Q, f2);
  ok(f2.calls.length === 0 && r2.stale.length === 0, 'second call within 24 h makes no fetch');

  await sql`update price_quote set fetched_at = now() - interval '25 hours' where quote = ${Q} and base = 'AED'`;
  const f3 = fakeFetch({ '/v6/latest/MVR': erApi(0.0125) });
  await ensureRates('h', ['USD', 'AED', 'XAU'], Q, f3);
  ok(f3.calls.length === 1 && f3.calls[0].endsWith('/v6/latest/MVR'), 'only the stale base is refetched (one FX call, no metals)');

  // Same provider date again: the PK conflicts, fetched_at is refreshed, the rate is untouched.
  const f3b = fakeFetch({});
  const r3b = await ensureRates('h', ['USD', 'AED', 'XAU'], Q, f3b);
  ok(f3b.calls.length === 0 && r3b.stale.length === 0, 'unchanged provider date: the refetch refreshed fetched_at, so the next render makes no fetch');
  const [aed] = await sql`select rate::text, fetched_at > now() - interval '1 minute' as fresh from price_quote where quote = ${Q} and base = 'AED'`;
  ok(aed.fresh && aed.rate === (1 / 0.04375).toFixed(10), 'fetched_at moved, the stored rate did not');

  await freshModule();
  const f4 = fakeFetch({ '/v6/latest/MVR': 'fail' });
  await sql`update price_quote set fetched_at = now() - interval '25 hours' where quote = ${Q}`;
  const r4 = await ensureRates('h', ['USD', 'XAU'], Q, f4);
  ok(r4.stale.join() === 'USD,XAU', `a failing provider is swallowed and reported stale (${r4.stale})`);
  await freshModule();
  const f5 = fakeFetch({ '/v6/latest/MVR': { result: 'error' } });
  ok((await ensureRates('h', ['USD'], Q, f5)).stale.join() === 'USD', 'unparseable answer is stale, no throw');
  await freshModule();
  const f6 = fakeFetch({ '/v6/latest/MVR': erApi(-1) });
  ok((await ensureRates('h', ['USD'], Q, f6)).stale.join() === 'USD', 'a negative rate is discarded');

  // An outage: the first render pays for it, the next ones within 15 minutes do not fetch.
  await freshModule();
  const f7 = fakeFetch({ '/v6/latest/MVR': 'fail' });
  await ensureRates('h', ['USD'], Q, f7);
  const f8 = fakeFetch({ '/v6/latest/MVR': erApi(0.0125) });
  const r8 = await ensureRates('h', ['USD'], Q, f8);
  ok(f7.calls.length === 1 && f8.calls.length === 0 && r8.stale.join() === 'USD', 'after a failure the pair is not fetched again for 15 minutes');

  // A provider that hangs and ignores the signal: the whole call still returns in about 4 s.
  await freshModule();
  const hang = () => new Promise(() => {});
  const t0 = Date.now();
  const r9 = await ensureRates('h', ['USD', 'XAU', 'XAG'], Q, hang);
  const dt = Date.now() - t0;
  ok(r9.stale.length === 3 && dt < 5500, `a hanging provider costs one budget, ${dt} ms (not one per request)`);
  // Slow FX that does honour the signal, then metals share the same spent budget.
  await freshModule();
  const slow = (u, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(signal.reason)));
  const t1 = Date.now();
  const r10 = await ensureRates('h', ['USD', 'XAU'], Q, slow);
  ok(r10.stale.length === 2 && Date.now() - t1 < 5500, `a slow provider honouring the signal: ${Date.now() - t1} ms`);

  // The wrong pair is discarded; an invalid quote does nothing at all.
  await freshModule();
  const f11 = fakeFetch({ '/v6/latest/MVR': { ...erApi(0.0125), base_code: 'USD' } });
  ok((await ensureRates('h', ['USD'], Q, f11)).stale.join() === 'USD', 'an answer for another base currency is discarded');
  const f12 = fakeFetch({});
  const r12 = await ensureRates('h', ['USD'], 'toString', f12);
  const r13 = await ensureRates('h', ['USD'], 'ZZZ', f12);
  ok(f12.calls.length === 0 && r12.stale.length === 0 && r13.stale.length === 0, 'a quote that is not a listed currency fetches nothing');

  // holding_value values a USD pot from the fetched quote.
  const [hh] = await sql`insert into household (name, base_currency) values ('prices-check', ${Q}) returning id`;
  try {
    const [h] = await sql`insert into holding (household_id, kind, name, currency) values (${hh.id}, 'fx_cash', 'Dollars', 'USD') returning id`;
    await sql`insert into holding_snapshot (holding_id, household_id, as_of, quantity) values (${h.id}, ${hh.id}, current_date, 25000)`;
    const [v] = await sql`select value_minor::text, rate::text, rate_source from holding_value where id = ${h.id}`;
    // 25000 cents = $250 at 80 = 20000.00 MVR = 2000000 minor units
    ok(v.value_minor === '2000000' && v.rate_source === 'api', `holding_value: $250 pot = ${v.value_minor} minor at ${v.rate} (${v.rate_source})`);
  } finally {
    await sql`delete from household where id = ${hh.id}`;
  }
} finally { await clean(); await sql.end(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
