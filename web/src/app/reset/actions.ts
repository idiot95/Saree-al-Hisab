'use server';

import { AuthError } from 'next-auth';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { spendResetForLink, usePasswordReset } from '@/db/membership';
import { passwordSignInOpenNow } from '@/lib/password-window';
import { looksLikeLinkToken } from '@/lib/link-token';
import { sealLinkIntent } from '@/lib/link-intent';
import { RESET_COOKIE, RESET_MAX_AGE, flowCookieOptions } from '@/lib/flow-cookies';
import { hashPassword, passwordProblem } from '@/lib/password';
import { tooMany, waitMessage } from '@/db/rate-limit';

export type AuthResult = { error: string } | null;

export async function setNewPassword(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  // After the cutoff a password is one nobody could sign in with.
  if (!passwordSignInOpenNow()) {
    return { error: 'Passwords have ended. Use this link to link your Google account.' };
  }
  const wait = await tooMany('reset', 10, 15 * 60);
  if (wait) return { error: `Too many attempts. ${waitMessage(wait)}` };

  const token = String(fd.get('token') ?? '');
  const password = String(fd.get('password') ?? '');
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) {
    return { error: 'The two passwords do not match.' };
  }

  // Spends the link and sets the password together, and kills every other live
  // reset for that person — so a second link left lying around is dead too.
  const done = await usePasswordReset(token, await hashPassword(password));
  if (!done) return { error: 'That link has been used or has expired.' };

  try {
    await signIn('credentials', { email: done.email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Password changed. Please sign in.' };
    throw e;
  }
  return null;
}

/** After the password cutoff a reset link no longer sets a password. It is
 *  spent here — and every other live reset for the person, and their
 *  sessions, with it — and what it buys is ten minutes in which one Google
 *  account can be linked to them: the reset intent, sealed for 'reset' so
 *  it cannot be mistaken for Household's link intent. The signIn callback
 *  links only if that Google account is nobody's yet and the person has none,
 *  and never creates an account or accepts an invitation on the strength of
 *  it. A POST, not the page load, so a link preview cannot spend the link. */
export async function linkGoogleWithReset(fd: FormData): Promise<void> {
  const token = String(fd.get('token') ?? '');
  if (!looksLikeLinkToken(token)) redirect('/signin');
  // Before the cutoff the page sets a password, as it always has.
  if (passwordSignInOpenNow()) redirect(`/reset/${token}`);

  const wait = await tooMany('reset', 10, 15 * 60);
  if (wait) redirect(`/reset/${token}?e=wait`);
  // Checked before anything is spent: without it no intent can be sealed.
  const secret = process.env.AUTH_SECRET;
  if (!secret) redirect(`/reset/${token}?e=1`);

  const userId = await spendResetForLink(token);
  // Used or expired: the page says which.
  if (!userId) redirect(`/reset/${token}`);

  (await cookies()).set(RESET_COOKIE, sealLinkIntent(userId, secret, Date.now(), 'reset'),
    flowCookieOptions(RESET_MAX_AGE, (await headers()).get('x-forwarded-proto')));
  await signIn('google', { redirectTo: '/' });
}
