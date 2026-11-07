import 'server-only';

/* The ONLY writer of price_quote. fetched_at is now() in SQL and source is
   'api'; neither comes from a caller or a provider. Rates are fetched lazily,
   when something that values holdings renders: a pair whose newest fetch is
   under 24 hours old is left alone. There is no scheduler, on purpose.

   Not rate-limited by IP (tooMany buckets by caller): the guard is the table
   itself. Two first renders at once may both fetch; the upsert is harmless.
   When the provider's date has not moved (a weekend), the same quote is
   written again: only fetched_at is refreshed (the one column the app role may
   update), the rate stays what was first stored, so the guard holds.

   Uses the pool (price_quote is global, no row policy) rather than the
   household transaction, so a slow provider never holds that transaction open
   and a failure here can never poison it. householdId names who asked and is
   not otherwise needed. Rendering must never fail because rates did. */
import { identity as sql } from './client';
import {
  parseFx, parseMetal, fxAsOf, metalAsOf, type Quote,
} from '@/lib/prices';
import { isCurrency } from '@/lib/money';

/* One budget for a whole ensureRates call (the FX request and the metal
   requests share it), so a render waits about this long at worst. */
const BUDGET_MS = 4000;
const MAX_BODY = 256 * 1024;
/* A provider that failed is left alone for this long, so an outage costs the
   first render a few seconds and the rest nothing. Per process, in memory:
   a cold start forgets it, which only means one more try. Nothing resets it from outside: scripts/prices.check
   takes a fresh instance of the module instead. */
const RETRY_AFTER_MS = 15 * 60 * 1000;
const failedAt = new Map<string, number>();
const recentlyFailed = (key: string) => Date.now() - (failedAt.get(key) ?? 0) < RETRY_AFTER_MS;
const fail = (key: string) => { failedAt.set(key, Date.now()); };

const METALS = ['XAU', 'XAG'] as const;
type Metal = (typeof METALS)[number];
const isMetal = (b: string): b is Metal => (METALS as readonly string[]).includes(b);

async function getJson(url: string, fetchImpl: typeof fetch, signal: AbortSignal): Promise<unknown | null> {
  // Raced against the signal as well, so a fetch that ignores it cannot hold the render.
  const aborted = new Promise<never>((_, rej) => {
    const e = () => rej(Object.assign(new Error('budget'), { name: 'TimeoutError' }));
    if (signal.aborted) e(); else signal.addEventListener('abort', e, { once: true });
  });
  aborted.catch(() => {});
  try {
    const res = await Promise.race([
      fetchImpl(url, { signal, headers: { accept: 'application/json' }, cache: 'no-store' }),
      aborted,
    ]);
    if (!res.ok) { console.error('rates: http', res.status); return null; }
    if (Number(res.headers.get('content-length')) > MAX_BODY) { console.error('rates: body too large'); return null; }
    const text = await Promise.race([res.text(), aborted]);
    if (text.length > MAX_BODY) { console.error('rates: body too large'); return null; }
    return JSON.parse(text);
  } catch (e) {
    // The name only: a URL or message could carry more than a log should.
    console.error('rates: fetch failed', e instanceof Error ? e.name : 'Error');
    return null;
  }
}

async function freshBases(quote: string, bases: string[]): Promise<Set<string>> {
  const rows = await sql<{ base: string }[]>`
    select distinct base from price_quote
    where quote = ${quote} and base = any(${bases})
      and fetched_at > now() - interval '24 hours'`;
  return new Set(rows.map((r) => r.base));
}

/* as_of is the provider's date, but the database's today is the authority:
   least() keeps a provider that runs ahead from writing a date holding_value
   would never see. */
async function store(q: Omit<Quote, 'asOf'> & { asOf: string | null }) {
  await sql`
    insert into price_quote (base, quote, as_of, rate, source, fetched_at)
    values (${q.base}, ${q.quote}, least(coalesce(${q.asOf}::date, current_date), current_date),
            ${q.rate}::numeric, 'api', now())
    on conflict (base, quote, as_of, source) do update set fetched_at = now()`;
}

/** The bases a quote currency can be priced in: real currencies and the two metals, never the quote itself. Empty
 *  for a quote that is not a currency. Shared with the render's due check (holdings.ts `dueRateBases`). */
export function priceableBases(bases: string[], quote: string): string[] {
  if (!/^[A-Z]{3}$/.test(quote) || !isCurrency(quote)) return [];
  return [...new Set(bases)].filter(
    (b) => b !== quote && /^[A-Z]{3}$/.test(b) && (isCurrency(b) || isMetal(b)));
}

/* Fetches and stores what is due. Wealth no longer calls this while it renders (v3.1 P5): the page renders with the
   last known rates and its screen asks POST /api/rates, which calls this, once it is on screen — so a render (a
   prefetch included) makes no network call and writes nothing. The holding page still calls it as it renders. */
export async function ensureRates(
  _householdId: string, // kept for the plan's signature; the pool is used, see above
  bases: string[], quote: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ stale: string[]; refreshed: string[] }> {
  const wanted = priceableBases(bases, quote);
  if (wanted.length === 0) return { stale: [], refreshed: [] };
  try {
    const fresh = await freshBases(quote, wanted);
    const due = wanted.filter((b) => !fresh.has(b));
    if (due.length === 0) return { stale: [], refreshed: [] };

    const signal = AbortSignal.timeout(BUDGET_MS);
    // One FX call per quote currency serves every currency base and the USD
    // rate the metals need.
    const fxBases = due.filter((b) => !isMetal(b));
    const metals = due.filter(isMetal);
    const got = new Set<string>();
    let usd: string | undefined = quote === 'USD' ? '1' : undefined;

    if ((fxBases.length || (metals.length && quote !== 'USD')) && !recentlyFailed(`FX:${quote}`)) {
      const fxJson = await getJson(`https://open.er-api.com/v6/latest/${quote}`, fetchImpl, signal);
      const fxDate = fxAsOf(fxJson);
      const fx = parseFx(fxJson, quote, [...fxBases, 'USD'], fxDate ?? '');
      if (fx.length === 0) { console.error('rates: nothing parsed (fx)'); fail(`FX:${quote}`); }
      usd ??= fx.find((q) => q.base === 'USD')?.rate;
      for (const q of fx) if (fxBases.includes(q.base)) { await store({ ...q, asOf: fxDate }); got.add(q.base); }
    }

    if (usd) {
      await Promise.all(metals.filter((m) => !recentlyFailed(`${m}:${quote}`)).map(async (m) => {
        const json = await getJson(`https://api.gold-api.com/price/${m}`, fetchImpl, signal);
        const q = parseMetal(json, m, usd, '', quote);
        if (!q) { console.error('rates: nothing parsed (metal)'); fail(`${m}:${quote}`); return; }
        await store({ ...q, asOf: metalAsOf(json) });
        got.add(m);
      }));
    }
    return { stale: due.filter((b) => !got.has(b)), refreshed: [...got] };
  } catch (e) {
    console.error('rates: ensureRates failed', e instanceof Error ? e.name : 'Error');
    return { stale: wanted, refreshed: [] };
  }
}
