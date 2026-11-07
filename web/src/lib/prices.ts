/* Prices from outside, parsed as untrusted input. Pure: no fetch, no database
   (src/db/prices.ts does both), so every rule here is tested on its own.

   A rate is accepted only when it is a finite number, above zero and below
   1e9 — the same bounds as price_quote's CHECK — and comes out as a decimal
   string with at most ten places, the scale of numeric(24,10). Strings, not
   numbers, so nothing downstream is tempted to add them up as floats. */

export type Quote = { base: string; quote: string; rate: string; asOf: string };

/* Minor-unit digits, the lists drizzle/0110's currency_digits() carries. The
   lib test reads that file and money.ts and fails if any of the three drift. */
export const CURRENCY_DIGITS_SQL_3: readonly string[] = ['BHD', 'IQD', 'JOD', 'KWD', 'OMR', 'TND'];
export const CURRENCY_DIGITS_SQL_0: readonly string[] = ['JPY', 'KRW', 'UGX', 'VND'];

export const GRAMS_PER_TROY_OUNCE = 31.1034768;
const MAX_RATE = 1e9;
const CODE = /^[A-Z]{3}$/;

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** A rate as a decimal string, or null when it is not one we would store. */
function rateString(x: number): string | null {
  if (!Number.isFinite(x) || x <= 0 || x >= MAX_RATE) return null;
  const s = x.toFixed(10);
  // Rounding to ten places can turn a tiny rate into zero, which the table refuses.
  if (!(Number(s) > 0) || Number(s) >= MAX_RATE) return null;
  return s;
}

/** open.er-api.com /v6/latest/<quote>: rates are units of OTHER per 1 quote,
 *  so the price of one OTHER in quote is 1 / rate. */
export function parseFx(json: unknown, quote: string, bases: string[], asOf: string): Quote[] {
  if (!isObject(json) || json.result !== 'success' || json.base_code !== quote || !isObject(json.rates)) return [];
  const rates = json.rates;
  const out: Quote[] = [];
  for (const base of new Set(bases)) {
    if (!CODE.test(base) || base === quote) continue;
    if (!Object.hasOwn(rates, base)) continue;
    const per = rates[base];
    if (typeof per !== 'number' || !Number.isFinite(per) || per <= 0) continue;
    const rate = rateString(1 / per);
    if (rate) out.push({ base, quote, rate, asOf });
  }
  return out;
}

/** api.gold-api.com /price/<metal>: USD per troy ounce. Per gram of pure
 *  metal in the household's currency = price / 31.1034768 × (quote per USD). */
export function parseMetal(
  json: unknown, metal: 'XAU' | 'XAG', usdToQuote: string, asOf: string,
  quote = '',
): Quote | null {
  if (!isObject(json)) return null;
  if (json.symbol !== metal) return null;                      // the expected pair, strictly
  if (json.currency !== undefined && json.currency !== 'USD') return null;
  const price = json.price;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const fx = Number(usdToQuote);
  if (typeof usdToQuote !== 'string' || !Number.isFinite(fx) || fx <= 0) return null;
  const rate = rateString(price / GRAMS_PER_TROY_OUNCE * fx);
  return rate ? { base: metal, quote, rate, asOf } : null;
}

const today = () => new Date().toISOString().slice(0, 10);

/** A provider timestamp as a UTC date (YYYY-MM-DD), or null when it is
 *  missing, invalid, or in the future (a future date would never be "latest
 *  on or before today", so the quote would be invisible). */
function toDate(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  const s = d.toISOString().slice(0, 10);
  return s > today() || s < '2000-01-01' ? null : s;
}
export function fxAsOf(json: unknown): string | null {
  const t = isObject(json) ? json.time_last_update_unix : undefined;
  return typeof t === 'number' ? toDate(t * 1000) : null;
}
export function metalAsOf(json: unknown): string | null {
  const t = isObject(json) ? json.updatedAt : undefined;
  return typeof t === 'string' ? toDate(Date.parse(t)) : null;
}
