import type { GoogleClaims, SignInFacts } from './google-signin.ts';
import { openLinkIntent } from './link-intent.ts';

/* Everything decideGoogleSignIn needs to know, gathered from wherever it
   lives. The lookups are handed in so this stays testable without a database
   or a request; src/auth.ts wires the real ones. */
export type FactSources = {
  identityUser: (sub: string) => Promise<string | null>;
  userIdByEmail: (email: string) => Promise<string | null>;
  hasGoogle: (userId: string) => Promise<boolean>;
  /** The signed-in person, ONLY if the cookie is still honoured (not older
   *  than the account's session epoch). A revoked cookie is nobody. */
  sessionUserId: () => Promise<string | null>;
  linkIntentToken: string | undefined;
  /** AUTH_SECRET. Missing or empty means no link intent can be trusted. */
  secret: string | undefined;
  nowMs: number;
  invite: { email: string } | null;
};

export async function gatherSignInFacts(c: GoogleClaims, s: FactSources): Promise<SignInFacts> {
  const linkIntentUserId = s.secret && s.linkIntentToken
    ? openLinkIntent(s.linkIntentToken, s.secret, s.nowMs)
    : null;
  const [identityUserId, sessionUserId, emailOwnerId] = await Promise.all([
    s.identityUser(c.sub),
    s.sessionUserId(),
    s.userIdByEmail(c.email.toLowerCase()),
  ]);
  const sessionUserHasGoogle = sessionUserId ? await s.hasGoogle(sessionUserId) : false;
  return {
    identityUserId, sessionUserId, linkIntentUserId, sessionUserHasGoogle, emailOwnerId,
    invite: s.invite,
  };
}
