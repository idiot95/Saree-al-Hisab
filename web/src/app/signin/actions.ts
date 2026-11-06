'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { passwordSignInOpenNow } from '@/lib/password-window';
import { signInErrorPath } from '@/lib/signin-errors';
import { rethrowControlFlow } from '@/lib/rethrow';
import { findLoginUser, isLocked } from '@/db/membership';
import { tooMany, waitMessage } from '@/db/rate-limit';

export type AuthResult = { error: string } | null;

/** How long to wait, in words. "Try again in 4 minutes" is actionable;
 *  a timestamp is a puzzle. */
function waitFor(until: Date | null): string {
  if (!until) return 'in a moment';
  const mins = Math.ceil((new Date(until).getTime() - Date.now()) / 60000);
  if (mins <= 1) return 'in a minute';
  if (mins < 60) return `in ${mins} minutes`;
  return 'in about an hour';
}

/** The primary way in. signIn() redirects to Google by throwing, which is
 *  how a Server Action hands the browser on. */
export async function signInWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/' });
}

export async function signInWithPassword(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  // First, before anything is read or counted: after the cutoff there is no
  // password sign-in to attempt.
  if (!passwordSignInOpenNow()) redirect(signInErrorPath('cutoff'));

  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  /* The lockout on app_user stops someone grinding at one account. This stops
     the same effort being spread across many, which is what credential
     stuffing actually looks like. */
  const wait = await tooMany('signin', 10, 15 * 60);
  if (wait) return { error: `Too many sign-in attempts. ${waitMessage(wait)}` };

  /* Only to word the message. authorize() enforces the wait itself, because
     this action is not the only way to reach it. */
  const user = await findLoginUser(email);
  if (user && isLocked(user)) {
    return { error: `Too many attempts. Try again ${waitFor(user.locked_until)}.` };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    rethrowControlFlow(e); // the redirect on success travels as a thrown error
    // One message for a wrong password and for an address with no account.
    if (e instanceof AuthError) return { error: 'That email and password do not match.' };
    throw e;
  }
  return null;
}
