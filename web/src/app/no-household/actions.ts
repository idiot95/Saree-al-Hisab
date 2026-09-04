'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { createHousehold, membershipOf } from '@/db/membership';

export type Result = { error: string } | null;

/* For someone with an account and nowhere to put anything — usually because
   they were shown the door. Being removed from a household should not be the
   end of the road; it should be the start of your own. */
export async function startYourOwnBooks(_prev: Result, fd: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (await membershipOf(session.user.id)) redirect('/');

  const name = String(fd.get('name') ?? '').trim();
  if (name.length < 2) return { error: 'Give your household a name.' };
  if (name.length > 60) return { error: 'Household names are 60 characters at most.' };

  await createHousehold(session.user.id, name);
  revalidatePath('/', 'layout');
  redirect('/');
}
