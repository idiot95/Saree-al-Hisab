import 'server-only';

/* The ONLY writer of price_quote. fetched_at is now() in SQL and source is
   'api'; neither comes from a caller or a provider. Rates are fetched lazily,
   when something that values holdings renders: a pair whose newest fetch is
   under 24 hours old is left alone. There is no scheduler, on purpose.

   Not rate-limited by IP (tooMany buckets by caller): the guard is the table
   itself. Two first renders at once may both fetch; the insert is
   `on conflict do nothing`, so the second is harmless.

   Uses the pool (price_quote is global, no row policy) rather than the
   household transaction, so a slow provider never holds that transaction open
   and a failure here can never poison it. householdId names who asked and is
   not otherwise needed. Rendering must never fail because rates did. */
import { identity as sql } from './client';
import {
  parseFx, parseMetal, fxAsOf, metalAsOf, type Quote,
} from '@/lib/prices';

const TIMEOUT_MS = 4000;
const METALS = ['XAU', 'XAG'] as const;
type Metal = (typeof METALS)[number];
const isMetal = (b: string): b is Metal => (METALS as readonly string[]).includes(b);

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown | null> {
  try {
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
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

async function store(q: Omit<Quote, 'asOf'> & { asOf: string | null }) {
  await sql`
    insert into price_quote (base, quote, as_of, rate, source, fetched_at)
    values (${q.base}, ${q.quote}, coalesce(${q.asOf}::date, current_date),
            ${q.rate}::numeric, 'api', now())
    on conflict do nothing`;
}

export async function ensureRates(
  _householdId: string, bases: string[], quote: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ stale: string[] }> {
  const wanted = [...new Set(bases)].filter((b) => /^[A-Z]{3}$/.test(b) && b !== quote);
  if (!/^[A-Z]{3}$/.test(quote) || wanted.length === 0) return { stale: [] };
  try {
    const fresh = await freshBases(quote, wanted);
    const due = wanted.filter((b) => !fresh.has(b));
    if (due.length === 0) return { stale: [] };

    // One FX call per quote currency serves every currency base and the USD
    // rate the metals need.
    const fxBases = due.filter((b) => !isMetal(b));
    const metals = due.filter(isMetal);
    const fxJson = await getJson(`https://open.er-api.com/v6/latest/${quote}`, fetchImpl);
    const fxDate = fxAsOf(fxJson);
    const got = new Set<string>();
    const fx = parseFx(fxJson, quote, [...fxBases, 'USD'], fxDate ?? '');
    for (const q of fx) if (fxBases.includes(q.base)) { await store({ ...q, asOf: fxDate }); got.add(q.base); }

    if (metals.length) {
      const usd = quote === 'USD' ? '1' : fx.find((q) => q.base === 'USD')?.rate;
      if (usd) {
        await Promise.all(metals.map(async (m) => {
          const json = await getJson(`https://api.gold-api.com/price/${m}`, fetchImpl);
          const q = parseMetal(json, m, usd, '', quote);
          if (q) { await store({ ...q, asOf: metalAsOf(json) }); got.add(m); }
        }));
      }
    }
    return { stale: due.filter((b) => !got.has(b)) };
  } catch (e) {
    console.error('rates: ensureRates failed', e instanceof Error ? e.name : 'Error');
    return { stale: wanted };
  }
}
