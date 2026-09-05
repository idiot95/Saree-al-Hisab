'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change entries.');
  return actor;
}

/* What an edit may touch: the amount, the date, the category, what it was
   called, and how it was paid. Not the KIND — turning an expense into a
   transfer changes which shape rules apply and which columns must be filled,
   and quietly rewriting a row into a different shape is how a ledger starts
   disagreeing with itself. Delete it and add it again instead. */
export async function updateEntry(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const id = String(fd.get('id') ?? '');
  const [existing] = await sql`
    select id, kind from txn
    where id = ${id} and household_id = ${actor.household_id} and deleted_at is null`;
  if (!existing) return { ok: false, error: 'That entry is not one of yours.' };

  const minor = amount(fd.get('amount'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };

  const occurredOn = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return { ok: false, error: 'That date is not valid.' };

  const merchant = String(fd.get('merchant') ?? '').trim() || null;
  const note = String(fd.get('note') ?? '').trim() || null;
  const isShared = fd.get('is_shared') === 'on';

  // A move carries no category; everything else must have one.
  const wantsCategory = !['transfer', 'card_payment', 'claim_receipt'].includes(existing.kind);
  let categoryId: string | null = null;
  if (wantsCategory) {
    const raw = String(fd.get('category_id') ?? '');
    const [cat] = await sql`
      select id from category
      where id = ${raw} and household_id = ${actor.household_id} and archived_at is null`;
    if (!cat) return { ok: false, error: 'Choose a category.' };
    categoryId = cat.id;
  }

  // The method decides the account, so the client still never names one — the
  // trigger restamps it, and re-files or clears the card cycle.
  const rawMethod = String(fd.get('payment_method_id') ?? '');
  let methodId: string | null = null;
  if (rawMethod) {
    const [m] = await sql`
      select id from payment_method
      where id = ${rawMethod} and household_id = ${actor.household_id} and archived_at is null`;
    if (!m) return { ok: false, error: 'That payment method is not one of yours.' };
    methodId = m.id;
  }

  try {
    await sql`
      update txn set amount = ${minor}, occurred_on = ${occurredOn}::date,
                     category_id = ${categoryId}, merchant = ${merchant}, note = ${note},
                     is_shared = ${isShared},
                     payment_method_id = coalesce(${methodId}, payment_method_id)
      where id = ${id} and household_id = ${actor.household_id}`;
  } catch (e) {
    const pg = e as { code?: string; constraint_name?: string };
    console.error('updateEntry refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
    return { ok: false, error: 'That change could not be saved.' };
  }

  revalidatePath('/entries');
  revalidatePath('/');
  revalidatePath('/accounts');
  redirect('/entries');
}

/* Marked deleted, never removed. Every view already filters on deleted_at, so
   the figures move immediately — but the row is still there if the household
   ever has to work out what happened. */
export async function deleteEntry(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const id = String(fd.get('id') ?? '');
  const done = await sql`
    update txn set deleted_at = now()
    where id = ${id} and household_id = ${actor.household_id} and deleted_at is null
    returning id`;
  if (!done.length) return { ok: false, error: 'That entry is not one of yours.' };

  revalidatePath('/entries');
  revalidatePath('/');
  revalidatePath('/accounts');
  redirect('/entries');
}
