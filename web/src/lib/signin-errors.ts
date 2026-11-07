/* What /signin?e=<code> says. The codes are the Google decision's refusals
   plus the password cutoff; anything else in the address says nothing, so a
   hand-edited link cannot put words on the sign-in screen. */
const SENTENCES = {
  'exists-link-first':
    'You already have books here. Sign in with your password once, then link Google from Household.',
  'already-linked': 'That Google account is already linked to someone.',
  'invite-mismatch':
    'This invitation was sent to a different address. Sign in with the Google account it was sent to.',
  unverified: "Google hasn't verified that address yet.",
  cutoff: 'Password sign-in has ended. Continue with Google.',
} as const;

export type SignInErrorCode = keyof typeof SENTENCES;

export function signInErrorSentence(code: unknown): string | null {
  if (typeof code !== 'string' || !Object.hasOwn(SENTENCES, code)) return null;
  return SENTENCES[code as SignInErrorCode];
}

/** The address a refusal sends someone to. */
export const signInErrorPath = (code: SignInErrorCode) => `/signin?e=${code}`;
