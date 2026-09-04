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
  if (mins <= 1) return 'in a minute — just about time to put the kettle on';
  if (mins < 60) return `in ${mins} minutes. Go make chai`;
  return 'in about an hour. Go do something else entirely';
}

export async function signInWithPassword(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  if (!email || !password) return { error: 'Both boxes. That is the whole form.' };

  /* Only to word the message. authorize() enforces the wait itself, because
     this action is not the only way to reach it. */
  const user = await findLoginUser(email);
  if (user && isLocked(user)) {
    return { error: `Too many wrong guesses. Try again ${waitFor(user.locked_until)}.` };
  }

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    // One message for a wrong password and for an address that has no account.
    // Telling them apart is how you learn whose money is kept here.
    if (e instanceof AuthError) {
      return { error: 'That pair does not go together. One of them is wrong and we shall not say which.' };
    }
    throw e; // the redirect on success travels as a thrown error; let it pass
  }
  return null;
}
