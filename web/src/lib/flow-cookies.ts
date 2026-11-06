/* The three short-lived cookies that carry a purpose across the round trip to
   Google and back: "link this Google account to me" (set from Household),
   "link it to the person this reset link was for" (set from /reset after the
   password cutoff) and "this sign-in is accepting that invitation" (set from
   /join). The signIn callback spends all three whatever happens there, and /signin
   drops them when Auth.js reports an error, which is the only thing a
   cancelled sign-in ever reaches.

   SameSite=Lax because Google's return is a top-level GET from another site,
   which Lax lets through and Strict would not. No domain, so the cookie never
   reaches a sibling host. httpOnly, since no script of ours needs to read it. */
export const LINK_COOKIE = 'ql.link';
export const INVITE_COOKIE = 'ql.invite';
/** Set by a spent reset link after the password cutoff: link Google to the
 *  person the link was for. Sealed with purpose 'reset', so a Household link
 *  intent can never be passed off as one. */
export const RESET_COOKIE = 'ql.reset';
export const LINK_MAX_AGE = 600;   // seconds; the seal itself expires at ten minutes too
export const INVITE_MAX_AGE = 900;
export const RESET_MAX_AGE = 600;

/** Secure only when the request itself arrived over https — the way Auth.js
 *  decides for its own cookies — so `next start` on plain http still works. */
export function flowCookieOptions(maxAge: number, forwardedProto: string | null | undefined) {
  const proto = (forwardedProto ?? '').split(',')[0].trim().toLowerCase();
  return {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
