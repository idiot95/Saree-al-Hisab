'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { acceptInviteFor } from '@/db/membership';

/* Note what this does NOT read: the token. The link is how someone is shown an
   invitation; what admits them is an open invite addressed to the email they
   are signed in with. So a link that leaks does nothing in a stranger's hands,
   and a person who was invited can accept from any link they can reach. */
export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get('token') ?? '');
  const session = await auth();
  if (!session?.user?.id || !session.user.email) redirect('/signin');

  const joined = await acceptInviteFor(session.user.id, session.user.email);
  redirect(joined ? '/' : `/join/${token}?e=1`);
}
