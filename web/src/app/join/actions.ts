'use server';

import { AuthError } from 'next-auth';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { acceptInviteAs, createFromInvite, openInviteEmail } from '@/db/membership';
import { passwordSignInOpenNow } from '@/lib/password-window';
import { looksLikeLinkToken } from '@/lib/link-token';
import { INVITE_COOKIE, INVITE_MAX_AGE, flowCookieOptions } from '@/lib/flow-cookies';
import { hashPassword, passwordProblem } from '@/lib/password';
import { tooMany, waitMessage } from '@/db/rate-limit';

export type AuthResult = { error: string } | null;

/** Someone with no account, holding an invitation. The address is the
 *  invitation's, not theirs to choose — it is who the invitation was for. */
export async function joinWithNewAccount(_prev: AuthResult, fd: FormData): Promise<AuthResult> {
  // After the cutoff an account with a password is one nobody could sign in to.
  if (!passwordSignInOpenNow()) {
    return { error: 'Joining with a password has ended. Accept with Google.' };
  }
  const wait = await tooMany('join', 10, 15 * 60);
  if (wait) return { error: `Too many attempts. ${waitMessage(wait)}` };

  const token = String(fd.get('token') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const password = String(fd.get('password') ?? '');

  if (name.length < 2) return { error: 'Enter your name.' };
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  if (String(fd.get('confirm') ?? '') !== password) {
    return { error: 'The two passwords do not match.' };
  }

  const made = await createFromInvite(token, name, await hashPassword(password));
  if (!made) return { error: 'That invitation is no longer valid. Ask for a new link.' };

  try {
    await signIn('credentials', { email: made.email, password, redirectTo: '/' });
  } catch (e) {
    if (e instanceof AuthError) return { error: 'Account created. Please sign in.' };
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

/** The primary way to accept: with the Google account the invitation was
 *  sent to. The token rides to Google and back in an httpOnly cookie, and
 *  the signIn callback decides — by the hash of the token, against the
 *  address Google vouches for — whether this is the person invited. Nothing
 *  is accepted here. */
export async function acceptWithGoogle(fd: FormData): Promise<void> {
  const token = String(fd.get('token') ?? '');
  if (!looksLikeLinkToken(token) || !(await openInviteEmail(token))) {
    redirect(looksLikeLinkToken(token) ? `/join/${token}?e=1` : '/signin');
  }
  (await cookies()).set(INVITE_COOKIE, token,
    flowCookieOptions(INVITE_MAX_AGE, (await headers()).get('x-forwarded-proto')));
  await signIn('google', { redirectTo: '/' });
}
