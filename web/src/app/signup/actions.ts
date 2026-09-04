'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { emailIsTaken, signUp } from '@/db/membership';
import { hashPassword, passwordProblem } from '@/lib/password';

export type AuthResult = { error: string } | null;

/* Anyone may sign up. What that gets you is your OWN household and nobody
   else's — getting into somebody's books still takes an invitation from them,
   which is the whole reason signing up can be open in the first place. */
export async function createAccountAndHousehold(
  _prev: AuthResult, fd: FormData,
): Promise<AuthResult> {
  const name = String(fd.get('name') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const household = String(fd.get('household') ?? '').trim();
  const password = String(fd.get('password') ?? '');

  if (name.length < 2) return { error: 'Enter your name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'That does not look like an email address.' };
  }
  if (household.length < 2) return { error: 'Give your household a name.' };
  if (household.length > 60) return { error: 'Household names are 60 characters at most.' };
  const weak = passwordProblem(password, email);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) {
    return { error: 'The two passwords do not match.' };
  }
  if (await emailIsTaken(email)) {
    return { error: 'That email already has an account. Sign in instead.' };
  }

  await signUp(email, name, await hashPassword(password), household);

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Account created. Please sign in.' };
    throw e;
  }
  return null;
}
