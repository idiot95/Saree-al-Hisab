'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { findLoginUser, isLocked } from '@/db/membership';

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

export async function signInWithPassword(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  /* Only to word the message. authorize() enforces the wait itself, because
     this action is not the only way to reach it. */
  const user = await findLoginUser(email);
  if (user && isLocked(user)) {
    return { error: `Too many attempts. Try again ${waitFor(user.locked_until)}.` };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    // One message for a wrong password and for an address with no account.
    if (e instanceof AuthError) return { error: 'That email and password do not match.' };
    throw e; // the redirect on success travels as a thrown error; let it pass
  }
  return null;
}
