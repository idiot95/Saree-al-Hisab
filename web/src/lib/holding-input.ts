import { digitsOf, fromKeys } from './money.ts';

/* What a person types into the holdings forms, turned into what the database
   stores — or into a sentence saying why not. Pure, so it is tested without a
   database. Nothing here goes through a float: a quantity is cut at the decimal
   point as text, and a rate stays a string all the way into numeric. */

export type Parsed<K extends string, V> = ({ ok: true } & { [P in K]: V }) | { ok: false; error: string };

const COMMA_HELP = 'Use a point for decimals, like 12.5.';
const INTL = /^\d{1,3}(,\d{3})+$/;
const INDIAN = /^\d{1,2}(,\d{2})*,\d{3}$/;

/** Trim, and let a comma through only as a grouping separator in the whole
 *  part (1,250 or 12,50,000). '12,5' is not 125: a comma anywhere else is
 *  refused, never dropped. Returns null when the text is refused. */
function tidy(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (!s.includes(',')) return s;
  const [whole, ...rest] = s.split('.');
  if (rest.length > 1 || rest[0]?.includes(',') || !(INTL.test(whole) || INDIAN.test(whole))) return null;
  return whole.replace(/,/g, '') + (rest.length ? `.${rest[0]}` : '');
}
const PLAIN = /^(\d*)(?:\.(\d*))?$/;

/** Grams with up to three decimals, as whole milligrams. The 4th decimal is
 *  refused rather than rounded: a weight is not a place to lose a milligram. */
export function gramsToMg(typed: unknown): Parsed<'mg', number> {
  const s = tidy(typed);
  if (s === null) return { ok: false, error: COMMA_HELP };
  const m = PLAIN.exec(s);
  if (!s || !m || (m[1] === '' && !m[2])) return { ok: false, error: 'Enter the weight in grams, like 12.5.' };
  const [, whole, frac = ''] = m;
  if (frac.length > 3) return { ok: false, error: 'A weight can have at most three decimals (milligrams).' };
  if (whole.length > 9) return { ok: false, error: 'That weight is too large to be right.' };
  return { ok: true, mg: Number(whole || '0') * 1000 + Number(frac.padEnd(3, '0')) };
}

const KARAT = new Map<string, number>([['24', 999], ['22', 916], ['18', 750], ['14', 585]]);
const GOLD_FINENESS = [999, 916, 750, 585];
const SILVER_FINENESS = [999, 925];

/** Karat or fineness in, permille out. Only the offered values are accepted. */
export function purityPermille(metal: unknown, typed: unknown): Parsed<'permille', number> {
  const s = String(typed ?? '').trim().toLowerCase();
  if (metal === 'gold') {
    const k = /^(\d{2})\s*k?$/.exec(s);
    const karat = k && KARAT.get(k[1]);
    if (karat) return { ok: true, permille: karat };
    if (/^\d{3}$/.test(s) && GOLD_FINENESS.includes(Number(s))) return { ok: true, permille: Number(s) };
    return { ok: false, error: 'Choose 24k, 22k, 18k or 14k for gold.' };
  }
  if (metal === 'silver') {
    if (s === 'sterling') return { ok: true, permille: 925 };
    if (/^\d{3}$/.test(s) && SILVER_FINENESS.includes(Number(s))) return { ok: true, permille: Number(s) };
    return { ok: false, error: 'Choose fine silver (999) or sterling (925).' };
  }
  return { ok: false, error: 'Choose gold or silver.' };
}

/** A price: positive, at most ten decimal places, below a billion. Returned as
 *  a normalised string for numeric(24,10) to take as it is. */
export function parseRate(typed: unknown): Parsed<'rate', string> {
  const s = tidy(typed);
  if (s === null) return { ok: false, error: COMMA_HELP };
  const m = PLAIN.exec(s);
  if (!s || !m || (m[1] === '' && !m[2])) return { ok: false, error: 'Enter a rate, like 271.5.' };
  const [, whole, frac = ''] = m;
  if (frac.length > 10) return { ok: false, error: 'A rate can have at most ten decimal places.' };
  const w = whole.replace(/^0+(?=\d)/, '') || '0';
  if (w.length > 9) return { ok: false, error: 'That rate is too large to be right.' };
  const f = frac.replace(/0+$/, '');
  if (w === '0' && f === '') return { ok: false, error: 'A rate must be more than zero.' };
  return { ok: true, rate: f ? `${w}.${f}` : w };
}

/** A pot's balance as typed in its own currency, in that currency's minor
 *  units. Refuses more decimals than the currency has instead of cutting them. */
export function fxQuantity(typed: unknown, currency: string): Parsed<'minor', number> {
  const s = tidy(typed);
  if (s === null) return { ok: false, error: COMMA_HELP };
  const m = PLAIN.exec(s);
  if (!s || !m || (m[1] === '' && !m[2])) return { ok: false, error: 'Enter the balance as a number, like 1500.' };
  const [, whole, frac = ''] = m;
  const d = digitsOf(currency);
  if (frac.length > d) {
    return { ok: false, error: d === 0 ? `${currency} has no decimals.` : `${currency} has at most ${d} decimals.` };
  }
  if (whole.length > 12) return { ok: false, error: 'That balance is too large to be right.' };
  const minor = fromKeys(s, currency);
  if (!Number.isSafeInteger(minor)) return { ok: false, error: 'That balance is too large to be right.' };
  return { ok: true, minor };
}

/** A calendar day, not in the future. `today` is the database's date, so the
 *  rule agrees with the views that decide what is current. */
export function dateProblem(typed: unknown, today: string): string | null {
  const s = String(typed ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!m || !d || d.toISOString().slice(0, 10) !== s || s < '1900-01-01') return 'Choose a valid date.';
  if (s > today) return 'That date is in the future.';
  return null;
}

/** Who may change holdings: an allow-list, so a role added later is refused
 *  until someone decides otherwise. */
export function canWrite(role: unknown): boolean {
  return role === 'owner' || role === 'adult';
}
