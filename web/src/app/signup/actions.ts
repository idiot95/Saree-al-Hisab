'use server';

import { AuthError } from 'next-auth';
import { signIn } from '@/auth';
import { createAccount, emailIsTaken } from '@/db/membership';
import { hashPassword, passwordProblem } from '@/lib/password';
import { tooMany, waitMessage } from '@/db/rate-limit';

export type AuthResult = { error: string } | null;

/* Anyone may sign up. What that gets you is an account and, on the next
   screen, your OWN household — never a way into somebody else's books, which
   still takes an invitation from them. That is the whole reason signing up
   can be open in the first place.

   The household is a separate step (/setup) rather than three more fields
   here, because it asks a different kind of question — what to call the
   books and what currency they are in — and someone who was invited never
   answers it at all. */
export async function createYourAccount(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  /* Sign-up is open, so it is also the cheapest way to probe which addresses
     are registered, and the cheapest way to fill the table with junk. */
  const wait = await tooMany('signup', 5, 60 * 60);
  if (wait) return { error: `Too many accounts created from here. ${waitMessage(wait)}` };

  const name = String(fd.get('name') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');

  if (name.length < 2) return { error: 'Enter your name.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'That does not look like an email address.' };
  }
  const weak = passwordProblem(password, email);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) {
    return { error: 'The two passwords do not match.' };
  }
  if (await emailIsTaken(email)) {
    return { error: 'That email already has an account. Sign in instead.' };
  }

  await createAccount(email, name, await hashPassword(password));

  try {
    await signIn('credentials', { email, password, redirectTo: '/setup' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Account created. Please sign in.' };
    throw e;
  }
  return null;
}
