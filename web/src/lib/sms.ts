/* Bank and UPI text messages, read as a draft entry. Pure: no network, no
   model. What it cannot read it leaves null and the caller decides. One-time
   passwords are recognised first, so they are never parsed and never stored. */
import { createHash } from 'node:crypto';
import { fromKeys, isCurrency } from './money.ts';

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

const OTP_WORDS = /\b(?:otp|one[- ]time password|verification code|passcode)\b/i;
const CODE_WORD = /\bcode\s*:?\s*\d{4,8}\b(?![.,]\d)/i;
const IS_CODE = /\bis\s*:?\s*\d{4,8}\b(?![.,]\d)|(?<![\d,.])\d{4,8}\s+is\s+(?:your|the)\b/i;
const TXN_VERB = /\b(?:debited|credited|spent|withdrawn|received|deposited)\b/i;

/** True for a one-time password however it is phrased. Checked before any
 *  parsing: "OTP for txn of Rs 500" is an OTP, whatever amount it carries. */
export function isOtp(text: string): boolean {
  if (OTP_WORDS.test(text) || CODE_WORD.test(text)) return true;
  // "is 123456" alone is weak (a limit, a balance); a message that reports a
  // transaction is not an OTP for saying "is".
  return IS_CODE.test(text) && !TXN_VERB.test(text);
}

/* ── amount ──────────────────────────────────────────────────────────── */

type Amount = { start: number; end: number; minor: number; currency: string };

// "Rs", "Rs.", "Rs:", "INR", "₹", or a three-letter currency code.
const AMOUNT = /(?:\b[Rr][Ss]\.?|\b[Ii][Nn][Rr]|(₹)|\b([A-Z]{3}))\s*:?\s*(\d[\d,]*(?:\.\d{1,3})?)/g;

// "Avl Bal Rs 5,000", "Available balance: AED 9,000", "Avl Cr Limit Rs 95,000".
const BALANCE = /\b(?:(?:avl|avail(?:able)?|ledger|closing|total|clear)\.?\s*)?(?:bal(?:ance)?|(?:cr\.?\s*)?limit)\b[\s:.\-]*(?:is\s+)?(?:[Rr][Ss]\.?|[Ii][Nn][Rr]|₹|[A-Z]{3})?\s*:?\s*\d[\d,]*(?:\.\d{1,3})?/gi;

function amounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const code = m[2] ? m[2] : 'INR';
    if (!isCurrency(code)) continue;
    const keys = m[3].replace(/,/g, '');
    if (keys.split('.')[0].length > 12) continue;
    out.push({ start: m.index!, end: m.index! + m[0].length, minor: fromKeys(keys, code), currency: code });
  }
  return out;
}

/* ── direction ───────────────────────────────────────────────────────── */

const DEBIT = /\b(?:debited|debit|spent|sent(?!\s+you\b)|paid(?!\s+you\b)|withdrawn|withdrawal|purchased?|(?:transferred|trf)\s+to)\b/gi;
const CREDIT = /\b(?:credited|credit\s+alert|received|deposited|refunded|(?:sent|paid)\s+you)\b/gi;

type Verb = { start: number; end: number; direction: 'debit' | 'credit' };

function verbs(text: string): Verb[] {
  const out: Verb[] = [];
  for (const m of text.matchAll(DEBIT)) out.push({ start: m.index!, end: m.index! + m[0].length, direction: 'debit' });
  for (const m of text.matchAll(CREDIT)) out.push({ start: m.index!, end: m.index! + m[0].length, direction: 'credit' });
  return out;
}

const gap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  Math.max(0, a.start - b.end, b.start - a.end);

/* ── last4, date, merchant ───────────────────────────────────────────── */

const LAST4 = /\b(?:a\/?c|acct|account|card)\b\.?\s*(?:no\.?|number)?\s*(?:ending(?:\s+(?:in|with))?)?\s*[:\-]?\s*[Xx*]*\d*?(\d{4})(?!\d)/i;

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

const VPA = /^[\w.\-]{2,}@[A-Za-z][\w]*$/;
const NAME_STOP = new Set(['on', 'via', 'using', 'ref', 'refno', 'upi', 'txn', 'from', 'to', 'at', 'with', 'for', 'by', 'in', 'is', 'utr', 'imps', 'neft']);
const ACCOUNT_WORD = new Set(['a/c', 'ac', 'acct', 'account', 'card', 'bank']);
const NOT_A_NAME = new Set(['your', 'my', 'the', 'a', 'an', 'atm']);

/** The name after one to/at/from, or null when what follows is an account, a number or nothing. */
function nameAfter(rest: string): string | null {
  const tokens = rest.slice(0, 120).trim().split(/\s+/);
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
  for (const m of text.matchAll(/\b(?:to|at|from)\s+/gi)) {
    if (++tries > 20) break;
    const n = nameAfter(text.slice(m.index! + m[0].length));
    if (n) return n.slice(0, MAX_MERCHANT).trim();
  }
  const who = /^([A-Za-z][\w .@\-]{1,40}?)\s+(?:sent|paid)\s+you\b/.exec(text);
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
  const clean = text.replace(BALANCE, ' ');
  const amts = amounts(clean);
  const vs = verbs(clean);

  let best: { a: Amount; v: Verb } | null = null;
  let bestGap = Infinity;
  for (const v of vs) for (const a of amts) {
    const g = gap(a, v);
    if (g < bestGap) { bestGap = g; best = { a, v }; }
  }

  return {
    amountMinor: best?.a.minor ?? null,
    currency: best?.a.currency ?? null,
    direction: best?.v.direction ?? null,
    last4: LAST4.exec(clean)?.[1] ?? null,
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
