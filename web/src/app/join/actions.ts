'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { acceptInviteAs, createFromInvite } from '@/db/membership';
import { hashPassword, passwordProblem } from '@/lib/password';

export type AuthResult = { error: string } | null;

/** Someone with no account, holding an invitation. The address is the
 *  invitation's, not theirs to choose — it is who the invitation was for. */
export async function joinWithNewAccount(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  const token = String(fd.get('token') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const password = String(fd.get('password') ?? '');

  if (name.length < 2) return { error: 'What should the household call you?' };
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) return { error: 'The two passwords are not the same.' };

  const made = await createFromInvite(token, name, await hashPassword(password));
  if (!made) return { error: 'That invitation is no longer good. Ask for a new link.' };

  try {
    await signIn('credentials', { email: made.email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Your account was made. Sign in with it.' };
    throw e;
  }
  return null;
}

/** Someone who already has an account, holding an invitation. */
export async function acceptInvitation(fd: FormData) {
  const token = String(fd.get('token') ?? '');
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect('/signin');
  const joined = await acceptInviteAs(token, session.user.id, session.user.email);
  redirect(joined ? '/' : `/join/${token}?e=1`);
}
