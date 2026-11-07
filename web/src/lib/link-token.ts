import { createHash, randomBytes } from 'node:crypto';

/* Invitations and password resets travel as a link, so the token in it is a
   credential. Two rules follow.
   
   256 bits of randomness, because it is the only thing standing in the way —
   there is no address to prove and no second factor.
   
   Only the SHA-256 is stored. A fast hash is the right tool here and a
   password KDF would be the wrong one: the token has full entropy, so there is
   no word list to work through, and the hash exists purely so that a copy of
   the database yields no working links. */

export const hashLinkToken = (token: string) =>
  createHash('sha256').update(token).digest('base64url');

export function newLinkToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashLinkToken(token) };
}

/** The shape newLinkToken makes: 32 bytes as base64url, 43 characters. Only
 *  for deciding whether a value may be put back into an address — whether it
 *  opens anything is the database's to say. */
export const looksLikeLinkToken = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

/** The SHA-256 of an SMS capture token, as hex. Same rule as above (full
 *  entropy, so a fast hash is right), but in hex: capture_token.token_hash
 *  is CHECKed as 64 hex characters, and capture_lookup takes it that way. */
export const hashCaptureToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
