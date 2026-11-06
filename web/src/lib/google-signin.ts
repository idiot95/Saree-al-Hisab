export type GoogleClaims = { sub: string; email: string; emailVerified: boolean };
export type SignInFacts = {
  identityUserId: string | null; // user already holding (google, sub)
  sessionUserId: string | null; // signed in right now
  linkIntentUserId: string | null; // from a valid link-intent cookie
  sessionUserHasGoogle: boolean;
  emailOwnerId: string | null; // app_user with lower(email) = lower(claims.email)
  invite: { email: string } | null; // an open invite being accepted
};
export type Decision =
  | { kind: 'signin'; userId: string }
  | { kind: 'link'; userId: string }
  | { kind: 'create' }
  | { kind: 'join-existing'; userId: string }
  | {
      kind: 'refuse';
      code: 'exists-link-first' | 'already-linked' | 'invite-mismatch' | 'unverified';
    };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Order: unverified, invite, link intent, known sub, email owner, create. */
export function decideGoogleSignIn(c: GoogleClaims, f: SignInFacts): Decision {
  if (!c.emailVerified) return { kind: 'refuse', code: 'unverified' };

  if (f.invite) {
    if (!same(f.invite.email, c.email)) return { kind: 'refuse', code: 'invite-mismatch' };
    if (f.identityUserId) return { kind: 'join-existing', userId: f.identityUserId };
  }

  if (f.linkIntentUserId && f.linkIntentUserId === f.sessionUserId) {
    if (f.sessionUserHasGoogle) return { kind: 'refuse', code: 'already-linked' };
    if (f.identityUserId && f.identityUserId !== f.linkIntentUserId) {
      return { kind: 'refuse', code: 'already-linked' };
    }
    return { kind: 'link', userId: f.linkIntentUserId };
  }

  if (f.identityUserId) return { kind: 'signin', userId: f.identityUserId };
  if (f.emailOwnerId) return { kind: 'refuse', code: 'exists-link-first' };
  return { kind: 'create' };
}
