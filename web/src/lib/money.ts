/* Money is an integer in the currency's minor unit — paise for INR, cents for
   USD — everywhere: in the database, in props, in state. A float never touches
   a ledger. These helpers are the only place a number becomes a string.      */

export type Minor = number;

const GROUPING: Record<string, string> = { INR: 'en-IN', USD: 'en-US' };
const SYMBOL: Record<string, string> = { INR: '₹', USD: '$' };

/** ₹2,15,600 — not ₹215,600. Indian grouping puts the first comma after three
 *  digits and every two after that, which `en-IN` gets right and a naive
 *  thousands separator does not. */
export function format(minor: Minor, currency = 'INR', opts: { sign?: boolean; paise?: boolean } = {}) {
  const whole = minor / 100;
  const body = new Intl.NumberFormat(GROUPING[currency] ?? 'en-IN', {
    minimumFractionDigits: opts.paise ? 2 : 0,
    maximumFractionDigits: opts.paise ? 2 : 0,
  }).format(Math.abs(whole));
  const sym = SYMBOL[currency] ?? '';
  const lead = opts.sign ? (minor < 0 ? '−' : '+') : minor < 0 ? '−' : '';
  return `${lead}${sym}${body}`;
}

/** What the keypad builds. The raw key string in, paise out — integer
 *  arithmetic only. Never parseFloat on a typed string, which is how ₹1,180
 *  becomes ₹1180.00000001. */
export function fromKeys(keys: string): Minor {
  if (keys === '') return 0;
  const [w, f] = keys.split('.');
  const whole = w.replace(/\D/g, '') || '0';
  const frac = ((f ?? '').replace(/\D/g, '') + '00').slice(0, 2);
  return Number(whole) * 100 + Number(frac);
}

/** What the keypad shows while you type. Groups the rupees and leaves the
 *  paise exactly as typed, so "2340." reads "2,340." mid-entry rather than
 *  jumping to "2,340.00" before you have finished. */
export function keysDisplay(keys: string, currency = 'INR') {
  const [w, f] = keys.split('.');
  const digits = w.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const whole = digits === ''
    ? '0'
    : new Intl.NumberFormat(GROUPING[currency] ?? 'en-IN').format(Number(digits));
  if (f === undefined) return whole;
  return whole + '.' + f.replace(/\D/g, '').slice(0, 2);
}

/** Guards the keypad: at most one point, at most two paise digits, and a
 *  ceiling so a stuck thumb cannot produce a ten-crore grocery bill. */
export function pushKey(keys: string, key: string): string {
  if (key === '.') return keys.includes('.') ? keys : (keys === '' ? '0.' : keys + '.');
  const [w, f] = keys.split('.');
  if (f !== undefined) return f.length >= 2 ? keys : keys + key;
  const next = (w === '0' ? '' : w) + key;
  return next.replace(/\D/g, '').length > 9 ? keys : next;
}

export const popKey = (keys: string) => keys.slice(0, -1);

export const symbolOf = (currency = 'INR') => SYMBOL[currency] ?? '';

/** A month key. Budgets are one row per category per month, keyed on the
 *  first — so this is the only way a month is ever written. */
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
