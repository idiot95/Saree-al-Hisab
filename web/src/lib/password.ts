import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  pw: string | Buffer, salt: Buffer, keylen: number,
  opts: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/* scrypt out of node's own crypto — no native module to fail a serverless
   build — at OWASP's recommended parameters rather than whatever was quick.
   N = 2^17 costs about a third of a second and 128 MB per hash. That is the
   entire point: it costs the same for anyone who has walked off with the
   database and is working through a word list.

   Stored as scrypt$logN$r$p$salt$hash, so the cost can be raised later and
   every existing hash still verifies against the parameters it was made with. */
const LOG_N = 17, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 256 * 1024 * 1024;
const b64 = (b: Buffer) => b.toString('base64url');

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEYLEN,
    { N: 2 ** LOG_N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${LOG_N}$${R}$${P}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64url'),
    expected.length, { N: 2 ** Number(logN), r: Number(r), p: Number(p), maxmem: MAXMEM });
  // Length is checked first because timingSafeEqual throws on a mismatch.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** True when a hash was made with weaker parameters than we use now, so a
 *  successful sign-in can quietly upgrade it. */
export function needsRehash(stored: string): boolean {
  const [scheme, logN, r, p] = stored.split('$');
  return scheme !== 'scrypt' || Number(logN) < LOG_N || Number(r) < R || Number(p) < P;
}

/* Somebody has to be given a hash to check against even when the address is
   unknown, or "no such account" becomes measurable with a stopwatch. */
let decoy: Promise<string> | null = null;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(32).toString('base64url'));
  return decoy;
}

/* NIST SP 800-63B: length and a check against known-bad choices, and no
   composition rules — forcing a capital and a digit produces Password1! and
   a sticky note, not security. */
const COMMON = new Set([
  'password', 'password1', 'passw0rd', 'letmein', 'welcome', 'iloveyou',
  'qwerty', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'abc123', 'monkey',
  'dragon', 'sunshine', 'princess', 'football', 'baseball', 'superman',
  'trustno1', 'whatever', 'starwars', 'admin', 'administrator', 'root',
  'india123', 'bharat123', 'mumbai123', 'ganesh123', 'krishna123',
  'quietledger', 'sareealhisab', 'hisab', 'money', 'finance', 'household',
]);

const MIN = 10, MAX = 128;

/** A message to show the person, or null when the password is fine. */
export function passwordProblem(password: string, email?: string | null): string | null {
  const pw = password.normalize('NFKC');
  if (pw.length < MIN) return `Use at least ${MIN} characters.`;
  if (pw.length > MAX) return `Use at most ${MAX} characters.`;
  if (pw.trim().length < MIN) return 'That is mostly spaces.';

  const flat = pw.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Nobody types `password`. They type password123, or 1password — the digits
  // bolted on either end are the tell, not a defence, so strip them and look
  // at what is really underneath.
  const core = flat.replace(/^\d+/, '').replace(/\d+$/, '');
  if (COMMON.has(flat) || COMMON.has(core)) {
    return 'That password is too common. Pick something else.';
  }
  if (/^(.)\1+$/.test(flat)) return 'That is the same character repeated.';
  if ('0123456789012345678901234567890'.includes(flat) && flat.length > 3) {
    return 'That is a run of numbers. Pick something else.';
  }
  if ('abcdefghijklmnopqrstuvwxyz'.includes(flat) && flat.length > 3) {
    return 'That is a run of letters. Pick something else.';
  }
  const local = email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (local && local.length >= 3 && flat.includes(local)) {
    return 'Do not build it from your email address.';
  }
  return null;
}
