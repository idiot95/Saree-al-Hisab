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
    select t.id, t.kind, t.counts_as_spend,
           (t.book_id is not null or exists (select 1 from claim c where c.txn_id = t.id)) as owed
    from txn t
    where t.id = ${id} and t.household_id = ${actor.household_id} and t.deleted_at is null`;
  if (!existing) return { ok: false, error: 'That entry is not one of yours.' };

  /* "Was this my spending" can only be revisited on a cost somebody owes back
     for. On a plain expense the form never shows the question, and a direct
     POST does not get to answer it either: an expense nobody owes for that is
     also not yours would simply vanish from the month. */
  const counts = existing.kind === 'expense' && existing.owed
    ? fd.get('counts_as_spend') === 'on'
    : existing.counts_as_spend;

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
                     is_shared = ${isShared}, counts_as_spend = ${counts},
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

/* The same soft delete, for a swipe in the list. No redirect — the list is
   already on screen and the row has already gone from it — and no dialog,
   because the safeguard is a better one: Undo. */
export async function removeEntry(id: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) {
    return { ok: false, error: 'That entry could not be read.' };
  }
  const done = await sql`
    update txn set deleted_at = now()
    where id = ${id} and household_id = ${actor.household_id} and deleted_at is null
    returning id`;
  if (!done.length) return { ok: false, error: 'That entry is not one of yours.' };
  revalidatePath('/entries');
  revalidatePath('/');
  revalidatePath('/accounts');
  return { ok: true };
}

/* Undo, and only undo: a row this household deleted in the last quarter of an
   hour. Anything older stays where the ledger put it — this is the safety net
   under a swipe, not a way to resurrect history. */
export async function restoreEntry(id: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) {
    return { ok: false, error: 'That entry could not be read.' };
  }
  const done = await sql`
    update txn set deleted_at = null
    where id = ${id} and household_id = ${actor.household_id}
      and deleted_at is not null and deleted_at > now() - interval '15 minutes'
    returning id`;
  if (!done.length) return { ok: false, error: 'That entry could not be brought back.' };
  revalidatePath('/entries');
  revalidatePath('/');
  revalidatePath('/accounts');
  return { ok: true };
}
