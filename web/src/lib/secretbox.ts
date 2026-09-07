import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';

/* Small secrets that have to live in the database — a household's own Gemini
   key, at the moment. Encrypted so that a copy of the database is not also a
   copy of everybody's API keys: whoever has the dump still needs AUTH_SECRET,
   which lives in the environment and not in Postgres.

   AES-256-GCM, a fresh 12-byte nonce every time, and the ciphertext carries
   its own tag. The key is derived from AUTH_SECRET with HKDF and a fixed
   label, so the same secret can safely be used for other purposes under a
   different label without the two sharing a key. */

const LABEL = 'quiet-ledger/secretbox/v1';

function key(secret: string): Buffer {
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short to derive from.');
  }
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0),
    Buffer.from(LABEL), 32));
}

/** v1.<nonce>.<ciphertext>.<tag>, all base64url. Versioned so the scheme can
 *  change later without guessing at what an old row was written with. */
export function seal(plain: string, secret: string): string {
  const nonce = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(secret), nonce);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', nonce.toString('base64url'), body.toString('base64url'),
          c.getAuthTag().toString('base64url')].join('.');
}

/** Returns null rather than throwing on anything malformed or tampered with —
 *  a key that will not open is the same problem as no key, and the caller
 *  should say so plainly rather than crashing a page. */
export function open(sealed: string, secret: string): string | null {
  try {
    const [v, n, b, t] = sealed.split('.');
    if (v !== 'v1' || !n || !b || !t) return null;
    const d = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(n, 'base64url'));
    d.setAuthTag(Buffer.from(t, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(b, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Enough to recognise your own key without printing it. */
export function hint(plain: string): string {
  return plain.length <= 8 ? '••••' : `${plain.slice(0, 4)}…${plain.slice(-4)}`;
}
