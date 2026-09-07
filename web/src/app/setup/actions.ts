'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { createHousehold, membershipOf } from '@/db/membership';
import { isCurrency } from '@/lib/money';

export type Result = { error: string } | null;

/* Books of your own. For a fresh account this is the second and last step of
   signing up; for someone shown the door of a household they were in, it is
   the way to a set of their own. Either way it only ever opens NEW books —
   nothing here can put you in someone else's. */
export async function setUpHousehold(_prev: Result, fd: FormData): Promise<Result> {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (await membershipOf(session.user.id)) redirect('/');

  const name = String(fd.get('name') ?? '').trim();
  const currency = String(fd.get('currency') ?? '').trim();
  if (name.length < 2) return { error: 'Give your household a name.' };
  if (name.length > 60) return { error: 'Household names are 60 characters at most.' };
  if (!isCurrency(currency)) return { error: 'Pick a currency from the list.' };

  await createHousehold(session.user.id, name, currency);
  revalidatePath('/', 'layout');
  redirect('/');
}
