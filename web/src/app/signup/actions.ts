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

  if (name.length < 2) return { error: 'A name. Any name. Even a nickname.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'That address is missing something. An @, probably.' };
  }
  if (household.length < 2) return { error: 'Your books need a name. “Home” is a perfectly good one.' };
  if (household.length > 60) return { error: 'That is a novel, not a name. Sixty characters, tops.' };
  const weak = passwordProblem(password, email);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) {
    return { error: 'Those two passwords are not speaking to each other.' };
  }
  if (await emailIsTaken(email)) {
    return { error: 'That address already has an account. Sign in, or admit you forgot.' };
  }

  await signUp(email, name, await hashPassword(password), household);

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Account made. Sign-in got shy — try it yourself.' };
    throw e;
  }
  return null;
}
