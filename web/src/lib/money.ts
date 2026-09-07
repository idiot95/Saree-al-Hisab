/* Money is an integer in the currency's minor unit — paise for INR, cents for
   USD — everywhere: in the database, in props, in state. A float never touches
   a ledger. These helpers are the only place a number becomes a string.      */

export type Minor = number;

/* Every currency a household can keep its books in. Only currencies with two
   decimals: the ledger stores minor units and everything here divides by a
   hundred, so a three-decimal dinar or a no-decimal shilling would be shown
   wrong — better not offered than offered wrong. Lakh grouping for the
   subcontinent (₹2,15,600), thousands everywhere else. Where a currency has
   no symbol of its own that reads on a phone, its code stands in, joined to
   the figure by a no-break space so "AED 1,250" never wraps in the middle. */
export const CURRENCIES: readonly { code: string; name: string; symbol: string; locale: string }[] = [
  { code: 'INR', name: 'Indian rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'PKR', name: 'Pakistani rupee', symbol: 'Rs\u00a0', locale: 'en-IN' },
  { code: 'LKR', name: 'Sri Lankan rupee', symbol: 'Rs\u00a0', locale: 'en-IN' },
  { code: 'BDT', name: 'Bangladeshi taka', symbol: '৳', locale: 'en-IN' },
  { code: 'NPR', name: 'Nepalese rupee', symbol: 'Rs\u00a0', locale: 'en-IN' },
  { code: 'AED', name: 'UAE dirham', symbol: 'AED\u00a0', locale: 'en-US' },
  { code: 'SAR', name: 'Saudi riyal', symbol: 'SAR\u00a0', locale: 'en-US' },
  { code: 'QAR', name: 'Qatari riyal', symbol: 'QAR\u00a0', locale: 'en-US' },
  { code: 'USD', name: 'US dollar', symbol: '$', locale: 'en-US' },
  { code: 'CAD', name: 'Canadian dollar', symbol: 'C$', locale: 'en-US' },
  { code: 'GBP', name: 'British pound', symbol: '£', locale: 'en-GB' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-IE' },
  { code: 'KES', name: 'Kenyan shilling', symbol: 'KSh\u00a0', locale: 'en-US' },
  { code: 'TZS', name: 'Tanzanian shilling', symbol: 'TSh\u00a0', locale: 'en-US' },
  { code: 'ZAR', name: 'South African rand', symbol: 'R', locale: 'en-US' },
  { code: 'MYR', name: 'Malaysian ringgit', symbol: 'RM', locale: 'en-US' },
  { code: 'SGD', name: 'Singapore dollar', symbol: 'S$', locale: 'en-US' },
  { code: 'AUD', name: 'Australian dollar', symbol: 'A$', locale: 'en-US' },
];

const GROUPING: Record<string, string> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.locale]));
const SYMBOL: Record<string, string> = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.symbol]));

export const isCurrency = (code: string) => code in SYMBOL;

/* Which currency a bare format() means. Every call site could name it, and
   client components do (through useMoney, which reads it from context). On
   the server the household on screen decides, once per request, and this is
   the hook that lets it: db/queries installs a resolver backed by React's
   per-request cache, so two households rendering at once on the same
   instance never see each other's symbol. Anything that runs before a
   resolver is installed — the client bundle, a test — gets rupees, which is
   what every entry already in the books was recorded in. */
let resolver: () => string = () => 'INR';
export function setCurrencyResolver(fn: () => string) { resolver = fn; }

/** ₹2,15,600 — not ₹215,600. Indian grouping puts the first comma after three
 *  digits and every two after that, which `en-IN` gets right and a naive
 *  thousands separator does not. */
export function format(minor: Minor, currency: string = resolver(), opts: { sign?: boolean; paise?: boolean } = {}) {
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
export function keysDisplay(keys: string, currency: string = resolver()) {
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

export const symbolOf = (currency: string = resolver()) => SYMBOL[currency] ?? '';

/** A month key. Budgets are one row per category per month, keyed on the
 *  first — so this is the only way a month is ever written. */
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
