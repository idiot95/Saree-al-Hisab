'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { createOwner, emailIsTaken, unclaimedHousehold } from '@/db/membership';
import { hashPassword, passwordProblem } from '@/lib/password';

export type AuthResult = { error: string } | null;

/* The first person through the door owns the books. There is exactly one such
   person, because claiming is what stops the household being unclaimed. */
export async function createFirstOwner(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  if (!(await unclaimedHousehold())) {
    return { error: 'This household already has an owner. Ask them to invite you.' };
  }

  const name = String(fd.get('name') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');

  if (name.length < 2) return { error: 'What should the household call you?' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'That does not look like an email address.' };
  const weak = passwordProblem(password, email);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) return { error: 'The two passwords are not the same.' };
  if (await emailIsTaken(email)) return { error: 'There is already an account for that address.' };

  const made = await createOwner(email, name, await hashPassword(password));
  if (!made) return { error: 'This household was claimed a moment ago. Ask the owner to invite you.' };

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Your account was made. Sign in with it.' };
    throw e;
  }
  return null;
}
