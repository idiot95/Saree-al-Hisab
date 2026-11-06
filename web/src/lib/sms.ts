/* Bank and UPI text messages, read as a draft entry. Pure: no network, no
   model. What it cannot read it leaves null and the caller decides. One-time
   passwords are recognised first, so they are never parsed and never stored. */
import { createHash } from 'node:crypto';
import { digitsOf, fromKeys, isCurrency } from './money.ts';

export type ParsedSms = {
  amountMinor: number | null;
  currency: string | null;
  direction: 'debit' | 'credit' | null;
  last4: string | null;
  merchant: string | null;
  date: string | null;
};

const MAX_TEXT = 2000;
const MAX_SENDER = 64;
const MAX_MERCHANT = 40;

/* ── OTP ─────────────────────────────────────────────────────────────── */

/* Every pattern below runs on text whose whitespace was collapsed to single
   spaces, and no two quantifiers next to each other can match the same
   characters, so a hostile 2 KB body cannot make the matcher back-track. */

const squeeze = (t: string) => t.replace(/\s+/g, ' ').trim();

const OTP_WORDS = new RegExp([
  '(?<![a-z])o\\.?t\\.?p\\.?s?(?![a-z])',            // OTP, OTPs, O.T.P., OTP482913
  'ओटीपी',                                              // Hindi
  '\\bone[- ]?time[- ]?(?:password|pin|passcode|code)',
  '\\b(?:verification|security|authentication|auth|login|secure|access|transaction) (?:code|pin)\\b',
  '\\b(?:passcode|mpin|password)\\b',
].join('|'), 'i');
// Words that sit beside a one-time number.
const CODE_NEAR = /\b(?:code|pin|mpin|password|passcode|otp|authori[sz]e[ds]?|authori[sz]ation|approve[ds]?|verification|do not share|never share|valid for|valid till|expires?)\b/i;
const STANDALONE_NUM = /(?<![\w.,₹-])\d{4,8}(?!\d|[.,]\d)/g;
const CURRENCY_BEFORE = /(?:\brs\.?|\binr|₹|([A-Z]{3})) ?:? ?$/i;

/** True for a one-time password however it is phrased. Checked before any
 *  parsing: "OTP for txn of Rs 500" is an OTP, whatever amount it carries.
 *  A missed OTP costs more than a lost draft, so this leans to true. */
export function isOtp(text: string): boolean {
  const t = squeeze(text);
  if (OTP_WORDS.test(t)) return true;
  if (/^\d{4,8} ?[-:–]/.test(t)) return true;
  for (const m of t.matchAll(STANDALONE_NUM)) {
    const at = m.index!;
    const pre = /(?:\brs\.?|\binr|₹) ?:? ?$/i.test(t.slice(Math.max(0, at - 6), at));
    const cc = /([A-Z]{3}) ?:? ?$/.exec(t.slice(Math.max(0, at - 6), at));
    if (pre || (cc && isCurrency(cc[1]))) continue;      // an amount, not a code
    const before = t.slice(Math.max(0, at - 40), at).split(' ').slice(-5).join(' ');
    const after = t.slice(at + m[0].length, at + m[0].length + 50).split(' ').slice(0, 6).join(' ');
    if (CODE_NEAR.test(before) || CODE_NEAR.test(after)) return true;
  }
  return false;
}

/* ── amount ──────────────────────────────────────────────────────────── */

type Amount = { start: number; end: number; minor: number; currency: string; preferred: boolean };

// "Rs", "Rs.", "Rs:", "INR", "₹", or a three-letter currency code, before the figure.
const AMOUNT = /(?:\b[Rr][Ss]\.?|\b[Ii][Nn][Rr]|(₹)|\b([A-Z]{3})) ?:? ?(\d[\d,]*(?:\.\d{1,3})?)/g;
// "500.00 AED": the code after the figure.
const AMOUNT_AFTER = /(?<![\w.,])(\d[\d,]*(?:\.\d{1,3})?) ?([A-Z]{3})\b/g;
const PREFERRED = /\b(?:amt|amount|of|for)[:.]? ?(?:[a-z]{2,3}\.?|₹)? ?:? ?$/i;

// "Avl Bal Rs 5,000", "balance after txn Rs 9,500", "Avl Cr Limit Rs 95,000",
// "Total Due Rs 5,000": the keyword, up to four words, then a currency and a figure.
const BALANCE = /\b(?:bal(?:ance)?|lmt|limit|due|outstanding)\b(?: \S{1,15}){0,4}? ?:?-? ?(?:rs\.?|inr|₹|[a-z]{3}) ?:? ?\d[\d,]*(?:\.\d{1,3})?/gi;

function toAmount(whole: string, code: string, start: number, end: number, text: string): Amount | null {
  const [w, f = ''] = whole.replace(/,/g, '').split('.');
  if (w.length > 12) return null;
  if (f.length > digitsOf(code)) return null;      // 3 decimals only where the currency has 3
  return { start, end, minor: fromKeys(f ? `${w}.${f}` : w, code), currency: code, preferred: PREFERRED.test(text.slice(Math.max(0, start - 14), start)) };
}

function amounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const code = m[2] ? m[2] : 'INR';
    if (!isCurrency(code)) continue;
    const a = toAmount(m[3], code, m.index!, m.index! + m[0].length, text);
    if (a) out.push(a);
  }
  for (const m of text.matchAll(AMOUNT_AFTER)) {
    if (!isCurrency(m[2])) continue;
    const start = m.index!, end = start + m[0].length;
    if (out.some((o) => o.start < end && start < o.end)) continue;
    const a = toAmount(m[1], m[2], start, end, text);
    if (a) out.push(a);
  }
  return out;
}

/* ── direction ───────────────────────────────────────────────────────── */

// A transaction that did not happen, or has not yet: no direction, no amount.
const NOT_DONE = /\b(?:failed|declined|unsuccessful|not (?:been )?debited|will be debited|is due|mandate)\b/i;
const REVERSAL = /\brevers(?:ed|al)\b/i;
const DEBIT = /\b(?:debited|debit(?! card)|spent|sent(?! you\b)|paid(?! you\b)|withdrawn|withdrawal|purchased?|used for|(?:transferred|trf) to)\b/gi;
const CREDIT = /\b(?:credited|credit alert|received|deposited|refunded|refund\b(?!@)|revers(?:ed|al)|(?:sent|paid) you)\b/gi;

type Verb = { start: number; end: number; direction: 'debit' | 'credit' };

function verbs(text: string): Verb[] {
  if (NOT_DONE.test(text)) return [];
  const out: Verb[] = [];
  if (!REVERSAL.test(text))                      // a reversal puts the money back, whatever else it says
    for (const m of text.matchAll(DEBIT)) out.push({ start: m.index!, end: m.index! + m[0].length, direction: 'debit' });
  for (const m of text.matchAll(CREDIT)) out.push({ start: m.index!, end: m.index! + m[0].length, direction: 'credit' });
  return out;
}

const gap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  Math.max(0, a.start - b.end, b.start - a.end);

/* ── last4, date, merchant ───────────────────────────────────────────── */

const LAST4 = /\b(?:a\/c|ac\b|acct\b|account\b|card\b)\.?(?: ?(?:no\.?|number))?(?: ?ending(?: (?:in|with))?)? ?[:-]? ?[Xx*.]*(\d{4,})(?!\d)/i;

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function isoDate(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || y < 1970 || y > 2100) return null;
  if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
const year = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));

/** The first date in the text, day before month (India). Null when it is not a real date. */
function findDate(text: string): string | null {
  const found: { at: number; iso: string | null }[] = [];
  for (const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g))
    found.push({ at: m.index!, iso: isoDate(Number(m[1]), Number(m[2]), Number(m[3])) });
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})(?!\d)/g))
    found.push({ at: m.index!, iso: isoDate(year(m[3]), Number(m[2]), Number(m[1])) });
  for (const m of text.matchAll(/(?<!\d)(\d{1,2})[-/ ]?([A-Za-z]{3})[-/ ]?(\d{4}|\d{2})(?!\d)/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) found.push({ at: m.index!, iso: isoDate(year(m[3]), mo, Number(m[1])) });
  }
  found.sort((a, b) => a.at - b.at);
  return found[0]?.iso ?? null;
}

const VPA = /^[\w.\-]+@[A-Za-z][\w]*$/;
const NAME_STOP = new Set(['on', 'via', 'using', 'ref', 'refno', 'upi', 'txn', 'from', 'to', 'at', 'with', 'for', 'by', 'in', 'is', 'utr', 'imps', 'neft',
  'initiated', 'declined', 'failed', 'reversed', 'has', 'been', 'was', 'successful', 'successfully', 'processed', 'not']);
const ACCOUNT_WORD = new Set(['a/c', 'ac', 'acct', 'account', 'card', 'bank']);
const NOT_A_NAME = new Set(['your', 'my', 'the', 'a', 'an', 'atm']);

/** The name after one to/at/from, or null when what follows is an account, a number or nothing. */
function nameAfter(rest: string): string | null {
  const tokens = rest.slice(0, 120).trim().split(' ');
  if (tokens[0]?.toLowerCase() === 'vpa') tokens.shift();
  const first = (tokens[0] ?? '').replace(/[).,;:!]+$/, '');
  if (VPA.test(first)) return first;
  const words: string[] = [];
  for (const raw of tokens) {
    const w = raw.replace(/[).,;:!]+$/, '');
    const lower = w.toLowerCase();
    if (!w || /^[\d(₹]/.test(w) || /^(?:rs\.?|inr)$/i.test(w) || NAME_STOP.has(lower)) break;
    if (ACCOUNT_WORD.has(lower)) return null;
    words.push(w);
    if (raw !== w && /[.,;]$/.test(raw)) break;
  }
  const name = words.join(' ');
  if (!name || NOT_A_NAME.has(words[0].toLowerCase()) || (words.length === 1 && NOT_A_NAME.has(name.toLowerCase()))) return null;
  return name;
}

function findMerchant(text: string): string | null {
  let tries = 0;
  for (const m of text.matchAll(/\b(?:to|at|from) /gi)) {
    if (++tries > 20) break;
    const n = nameAfter(text.slice(m.index! + m[0].length));
    if (n) return n.slice(0, MAX_MERCHANT).trim();
  }
  const who = /^([A-Za-z][\w .@\-]{1,40}?) (?:sent|paid) you\b/.exec(text);
  if (who) return who[1].trim().slice(0, MAX_MERCHANT).trim();
  const slash = /\bUPI\/(?:P2[AMP]\/)?\d+\/([^/]+?)(?=\.(?:\s|$)|[,;]|$)/.exec(text);
  if (slash) return slash[1].trim().slice(0, MAX_MERCHANT).trim() || null;
  return null;
}

/* ── parse ───────────────────────────────────────────────────────────── */

/** Read a bank or UPI message. A message with no debit/credit verb (a
 *  promotion, a loan offer) has no direction and no amount, so nothing in it
 *  can become money. The sender is accepted for the caller's routing; the
 *  body alone decides. */
export function parseSms(text: string, _sender?: string): ParsedSms {
  void _sender;
  const clean = squeeze(text).replace(BALANCE, ' ');
  const amts = amounts(clean);
  const vs = verbs(clean);

  // The amount beside "amt/of/for" is the transaction's; failing that, nearest the verb.
  let best: { a: Amount; v: Verb } | null = null;
  let bestKey: [number, number] = [2, Infinity];
  for (const v of vs) for (const a of amts) {
    const key: [number, number] = [a.preferred ? 0 : 1, gap(a, v)];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) { bestKey = key; best = { a, v }; }
  }

  const l4 = LAST4.exec(clean)?.[1];
  return {
    amountMinor: best?.a.minor ?? null,
    currency: best?.a.currency ?? null,
    direction: best?.v.direction ?? null,
    last4: l4 ? l4.slice(-4) : null,
    merchant: findMerchant(clean),
    date: findDate(clean),
  };
}

/* ── dedupe ──────────────────────────────────────────────────────────── */

/** SHA-256 hex of the text with whitespace collapsed: the same SMS forwarded twice hashes the same. */
export function bodyHash(text: string): string {
  return createHash('sha256').update(text.trim().replace(/\s+/g, ' ')).digest('hex');
}

/* ── capture endpoint body ───────────────────────────────────────────── */

export type Capture = { text: string; sender: string | null; receivedAt: string | null };

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function validIsoDatetime(s: string): boolean {
  const m = ISO_DATETIME.exec(s);
  if (!m) return false;
  if (!isoDate(Number(m[1]), Number(m[2]), Number(m[3]))) return false;
  if (Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6] ?? 0) > 59) return false;
  return Number.isFinite(Date.parse(s));
}

/** Check the JSON the capture endpoint receives. Only the body's own keys count: nothing inherited, nothing from a prototype. */
export function validateCapture(body: unknown): Capture | { error: 'shape' | 'size' } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { error: 'shape' };
  const proto = Object.getPrototypeOf(body);
  if (proto !== Object.prototype && proto !== null) return { error: 'shape' };
  const own = (k: string): unknown => (Object.hasOwn(body, k) ? (body as Record<string, unknown>)[k] : undefined);

  const rawText = own('text');
  if (typeof rawText !== 'string') return { error: 'shape' };
  const text = rawText.trim();
  if (text.length < 1 || text.length > MAX_TEXT) return { error: 'size' };

  const rawSender = own('sender');
  let sender: string | null = null;
  if (rawSender !== undefined && rawSender !== null) {
    if (typeof rawSender !== 'string') return { error: 'shape' };
    if (rawSender.length > MAX_SENDER) return { error: 'size' };
    sender = rawSender.trim() || null;
  }

  const rawAt = own('received_at');
  let receivedAt: string | null = null;
  if (rawAt !== undefined && rawAt !== null) {
    if (typeof rawAt !== 'string' || !validIsoDatetime(rawAt)) return { error: 'shape' };
    receivedAt = rawAt;
  }
  return { text, sender, receivedAt };
}
