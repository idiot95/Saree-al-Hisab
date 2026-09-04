'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { usePasswordReset } from '@/db/membership';
import { hashPassword, passwordProblem } from '@/lib/password';

export type AuthResult = { error: string } | null;

export async function setNewPassword(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  const token = String(fd.get('token') ?? '');
  const password = String(fd.get('password') ?? '');
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) return { error: 'The two passwords are not the same.' };

  // Spends the link and sets the password together, and kills every other live
  // reset for that person — so a second link left lying around is dead too.
  const done = await usePasswordReset(token, await hashPassword(password));
  if (!done) return { error: 'That link has been used already, or it has expired.' };

  try {
    await signIn('credentials', { email: done.email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Your password is changed. Sign in with it.' };
    throw e;
  }
  return null;
}
