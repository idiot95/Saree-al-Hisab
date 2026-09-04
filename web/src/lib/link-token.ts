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
