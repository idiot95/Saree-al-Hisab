/* Money is an integer in the currency's minor unit — paise for INR, cents for
   USD, fils for KWD — everywhere: in the database, in props, in state. A
   float never touches a ledger. These helpers are the only place a number
   becomes a string, and the only place a string becomes a number.          */

export type Minor = number;

/* Every currency a household can keep its books in.

   Each carries its own count of minor-unit digits: two for nearly all, three
   for the dinars and the Omani rial (1.500 KD is 1500 fils), none for the
   yen, the won, the dong and the Ugandan shilling. The ledger stores minor
   units whatever the currency, so a figure is right only if every helper
   here divides by the same unit — which is why nothing outside this file
   multiplies or divides by a hundred.

   Grouping: lakhs for the subcontinent (₹2,15,600), thousands everywhere
   else. Where a currency has a symbol a phone can draw, it is used — the
   rupee sign, the lira, the ruble, the naira, the Saudi riyal sign from 2025
   (U+20C1). Where the symbol is a bare letter that reads as an abbreviation
   (KD, Rs, KSh) it is joined to the figure by a no-break space, so
   "KD 1,250" never wraps in the middle. A code stands in where nothing
   better reads on a phone. */
export type Currency = {
  code: string; name: string; symbol: string;
  /** How many digits the minor unit has: 100 paise, 1000 fils, 1 yen. */
  digits: 0 | 2 | 3;
  /** 'lakh' groups 12,34,567; 'thousand' groups 1,234,567. */
  group: 'lakh' | 'thousand';
};

const nb = '\u00a0';
const c = (code: string, name: string, symbol: string, digits: 0 | 2 | 3 = 2, group: 'lakh' | 'thousand' = 'thousand'): Currency =>
  ({ code, name, symbol, digits, group });

export const CURRENCIES: readonly Currency[] = [
  // the subcontinent
  c('INR', 'Indian rupee', '₹', 2, 'lakh'),
  c('PKR', 'Pakistani rupee', `Rs${nb}`, 2, 'lakh'),
  c('LKR', 'Sri Lankan rupee', `Rs${nb}`),
  c('BDT', 'Bangladeshi taka', '৳', 2, 'lakh'),
  c('NPR', 'Nepalese rupee', `Rs${nb}`, 2, 'lakh'),
  c('MVR', 'Maldivian rufiyaa', `Rf${nb}`),
  // the Gulf and the Middle East
  c('AED', 'UAE dirham', `AED${nb}`),
  c('SAR', 'Saudi riyal', '\u20C1'),
  c('QAR', 'Qatari riyal', `QR${nb}`),
  c('KWD', 'Kuwaiti dinar', `KD${nb}`, 3),
  c('BHD', 'Bahraini dinar', `BD${nb}`, 3),
  c('OMR', 'Omani rial', `OMR${nb}`, 3),
  c('YER', 'Yemeni rial', `YER${nb}`),
  c('JOD', 'Jordanian dinar', `JD${nb}`, 3),
  c('IQD', 'Iraqi dinar', `IQD${nb}`, 3),
  c('EGP', 'Egyptian pound', 'E£'),
  c('TRY', 'Turkish lira', '₺'),
  c('ILS', 'Israeli shekel', '₪'),
  // Africa
  c('KES', 'Kenyan shilling', `KSh${nb}`),
  c('TZS', 'Tanzanian shilling', `TSh${nb}`),
  c('UGX', 'Ugandan shilling', `USh${nb}`, 0),
  c('ETB', 'Ethiopian birr', `Br${nb}`),
  c('ZAR', 'South African rand', 'R'),
  c('MUR', 'Mauritian rupee', `Rs${nb}`),
  c('NGN', 'Nigerian naira', '₦'),
  c('GHS', 'Ghanaian cedi', 'GH₵'),
  c('MAD', 'Moroccan dirham', `DH${nb}`),
  c('TND', 'Tunisian dinar', `DT${nb}`, 3),
  // the Americas and Europe
  c('USD', 'US dollar', '$'),
  c('CAD', 'Canadian dollar', 'C$'),
  c('MXN', 'Mexican peso', 'MX$'),
  c('BRL', 'Brazilian real', 'R$'),
  c('GBP', 'British pound', '£'),
  c('EUR', 'Euro', '€'),
  c('CHF', 'Swiss franc', `CHF${nb}`),
  c('SEK', 'Swedish krona', `kr${nb}`),
  c('NOK', 'Norwegian krone', `kr${nb}`),
  c('DKK', 'Danish krone', `kr${nb}`),
  c('PLN', 'Polish złoty', `zł${nb}`),
  c('CZK', 'Czech koruna', `Kč${nb}`),
  c('RUB', 'Russian ruble', '₽'),
  c('UAH', 'Ukrainian hryvnia', '₴'),
  c('KZT', 'Kazakhstani tenge', '₸'),
  c('AZN', 'Azerbaijani manat', '₼'),
  c('GEL', 'Georgian lari', '₾'),
  // Asia-Pacific
  c('SGD', 'Singapore dollar', 'S$'),
  c('MYR', 'Malaysian ringgit', `RM${nb}`),
  c('IDR', 'Indonesian rupiah', `Rp${nb}`),
  c('THB', 'Thai baht', '฿'),
  c('PHP', 'Philippine peso', '₱'),
  c('VND', 'Vietnamese dong', '₫', 0),
  c('HKD', 'Hong Kong dollar', 'HK$'),
  c('CNY', 'Chinese yuan', 'CN¥'),
  c('JPY', 'Japanese yen', '¥', 0),
  c('KRW', 'South Korean won', '₩', 0),
  c('AUD', 'Australian dollar', 'A$'),
  c('NZD', 'New Zealand dollar', 'NZ$'),
];

const BY_CODE: Record<string, Currency> = Object.fromEntries(CURRENCIES.map((x) => [x.code, x]));
const LOCALE = { lakh: 'en-IN', thousand: 'en-US' } as const;

export const isCurrency = (code: string) => code in BY_CODE;

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

const ccy = (code: string) => BY_CODE[code] ?? BY_CODE.INR;

/** How many minor-unit digits: 2 for rupees, 3 for a dinar, 0 for yen. */
export const digitsOf = (currency: string = resolver()) => ccy(currency).digits;
/** Minor units in one whole unit: 100 paise, 1000 fils, 1 yen. */
export const unitOf = (currency: string = resolver()) => 10 ** ccy(currency).digits;
export const symbolOf = (currency: string = resolver()) => ccy(currency).symbol;

/** ₹2,15,600 — not ₹215,600. Indian grouping puts the first comma after three
 *  digits and every two after that, which `en-IN` gets right and a naive
 *  thousands separator does not. `paise` shows the minor units in full —
 *  the accounting form, ₹2,15,600.00 — otherwise they are rounded away. */
export function format(minor: Minor, currency: string = resolver(), opts: { sign?: boolean; paise?: boolean } = {}) {
  const x = ccy(currency);
  const whole = Math.abs(minor) / 10 ** x.digits;
  const body = new Intl.NumberFormat(LOCALE[x.group], {
    minimumFractionDigits: opts.paise ? x.digits : 0,
    maximumFractionDigits: opts.paise ? x.digits : 0,
  }).format(whole);
  const lead = opts.sign ? (minor < 0 ? '−' : '+') : minor < 0 ? '−' : '';
  return `${lead}${x.symbol}${body}`;
}

/* "Keys" are the digits of an amount as a person types them — "2340.5" — the
   whole part, at most one point, and the minor digits so far. They are what
   an amount field holds while it is being filled, and every helper below
   turns keys into paise or paise into keys with integer arithmetic only.
   Never parseFloat on a typed string, which is how ₹1,180 becomes
   ₹1180.00000001. */

/** Keys in, minor units out. */
export function fromKeys(keys: string, currency: string = resolver()): Minor {
  if (keys === '') return 0;
  const d = digitsOf(currency);
  const [w, f] = keys.split('.');
  const whole = w.replace(/\D/g, '') || '0';
  const frac = ((f ?? '').replace(/\D/g, '') + '0'.repeat(d)).slice(0, d);
  return Number(whole) * 10 ** d + (frac ? Number(frac) : 0);
}

/** Minor units back into keys, for a field that edits an amount already in
 *  the books: 150000 is "1500", 150050 is "1500.50". A whole figure stays
 *  whole so it is easy to retype. */
export function toKeys(minor: Minor, currency: string = resolver()): string {
  const d = digitsOf(currency);
  const unit = 10 ** d;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / unit);
  const frac = abs % unit;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(d, '0')}`;
}

/** What an amount field shows while you type. Groups the rupees and leaves the
 *  paise exactly as typed, so "2340." reads "2,340." mid-entry rather than
 *  jumping to "2,340.00" before you have finished. */
export function keysDisplay(keys: string, currency: string = resolver()) {
  const x = ccy(currency);
  const [w, f] = keys.split('.');
  const digits = w.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const whole = digits === ''
    ? '0'
    : new Intl.NumberFormat(LOCALE[x.group]).format(Number(digits));
  if (f === undefined || x.digits === 0) return whole;
  return whole + '.' + f.replace(/\D/g, '').slice(0, x.digits);
}

/** The accounting form of what was typed, for when the field is left: the
 *  minor digits filled out — "2340" becomes "2340.00", "2340.5" becomes
 *  "2340.50" — and nothing at all stays nothing. */
export function settleKeys(keys: string, currency: string = resolver()): string {
  const clean = typed(keys, currency);
  if (clean === '') return '';
  const d = digitsOf(currency);
  const [w, f = ''] = clean.split('.');
  const whole = w.replace(/^0+(?=\d)/, '') || '0';
  return d === 0 ? whole : `${whole}.${(f + '0'.repeat(d)).slice(0, d)}`;
}

/** What the phone's own keyboard produced, tidied into keys: anything that is
 *  not a digit or the first point is dropped (a comma the person typed, a
 *  symbol pasted in, a second point), at most `digits` minor digits are kept,
 *  a currency with no minor unit takes no point at all, and the whole part
 *  is capped at nine digits so a stuck thumb cannot produce a ten-crore
 *  grocery bill. */
export function typed(raw: string, currency: string = resolver()): string {
  const d = digitsOf(currency);
  const s = raw.replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  let whole = (dot === -1 ? s : s.slice(0, dot)).replace(/^0+(?=\d)/, '');
  if (whole.length > 9) whole = whole.slice(0, 9);
  if (dot === -1 || d === 0) return whole;
  const frac = s.slice(dot + 1).replace(/\D/g, '').slice(0, d);
  return `${whole || '0'}.${frac}`;
}

/** Guards a drawn keypad: at most one point, at most `digits` minor digits,
 *  and the same nine-digit ceiling. */
export function pushKey(keys: string, key: string, currency: string = resolver()): string {
  const d = digitsOf(currency);
  if (key === '.') return d === 0 || keys.includes('.') ? keys : (keys === '' ? '0.' : keys + '.');
  const [w, f] = keys.split('.');
  if (f !== undefined) return f.length >= d ? keys : keys + key;
  const next = (w === '0' ? '' : w) + key;
  return next.replace(/\D/g, '').length > 9 ? keys : next;
}

export const popKey = (keys: string) => keys.slice(0, -1);

/** A month key. Budgets are one row per category per month, keyed on the
 *  first — so this is the only way a month is ever written. */
export const monthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
