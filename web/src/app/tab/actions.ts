'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change tabs.');
  return actor;
}

/* A tab is a few people you cover costs for — the flat, a trip, the office
   petrol, the medical bills somebody else reimburses. A cost put on it is
   lent to them the moment it is saved, one loan per person, and the tab's
   screen adds those up and takes the money back. Every action here re-checks
   that the tab and the person belong to the household asking, because a
   hidden button is not a rule. */
export async function createTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const note = String(fd.get('note') ?? '').trim() || null;

  if (name.length < 2) return { ok: false, error: 'Give the tab a name.' };
  if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };

  const [clash] = await sql`
    select 1 from ledger_book
    where household_id = ${actor.household_id} and lower(name) = ${name.toLowerCase()}`;
  if (clash) return { ok: false, error: 'You already have a tab by that name.' };

  // Whoever was ticked on the form; anyone not in this household is dropped.
  const wanted = fd.getAll('counterpartyId').map(String).filter((id) => UUID.test(id));
  const people = wanted.length
    ? await sql`select id from counterparty
                where household_id = ${actor.household_id} and archived_at is null
                  and id = any(${wanted}::uuid[])`
    : [];

  const [b] = await sql.begin(async (tx) => {
    const [row] = await tx`
      insert into ledger_book (household_id, name, note)
      values (${actor.household_id}, ${name}, ${note}) returning id`;
    for (const p of people) {
      await tx`insert into book_member (book_id, counterparty_id) values (${row.id}, ${p.id})`;
    }
    return [row];
  });

  revalidatePath('/people');
  revalidatePath('/add');
  redirect(`/tab/${b.id}`);
}

export async function renameTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('tabId') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const note = String(fd.get('note') ?? '').trim() || null;
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: 'Use between 2 and 60 characters.' };
  }
  const done = await sql`
    update ledger_book set name = ${name}, note = ${note}
    where id = ${id} and household_id = ${actor.household_id} returning id`;
  if (!done.length) return { ok: false, error: 'That tab is not one of yours.' };
  revalidatePath(`/tab/${id}`);
  revalidatePath('/people');
  revalidatePath('/add');
  return { ok: true, message: 'Saved.' };
}

export async function addToTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const tabId = String(fd.get('tabId') ?? '');
  const personId = String(fd.get('counterpartyId') ?? '');

  // Both ids are checked against this household before they are joined, or a
  // tab here could be pointed at a person there.
  const [b] = await sql`select id from ledger_book
    where id = ${tabId} and household_id = ${actor.household_id}`;
  const [p] = await sql`select id from counterparty
    where id = ${personId} and household_id = ${actor.household_id} and archived_at is null`;
  if (!b || !p) return { ok: false, error: 'That is not one of yours.' };

  await sql`insert into book_member (book_id, counterparty_id)
            values (${b.id}, ${p.id}) on conflict do nothing`;
  revalidatePath(`/tab/${tabId}`);
  revalidatePath('/people');
  revalidatePath('/add');
  return { ok: true };
}

/** Taking someone off a tab stops them being included in what is put on it
 *  from now on. What they already owe stays owed — the money was really laid
 *  out for them, and leaving the tab does not bring it back. */
export async function removeFromTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const tabId = String(fd.get('tabId') ?? '');
  const [b] = await sql`select id from ledger_book
    where id = ${tabId} and household_id = ${actor.household_id}`;
  if (!b) return { ok: false, error: 'That tab is not one of yours.' };
  await sql`delete from book_member
            where book_id = ${b.id} and counterparty_id = ${String(fd.get('counterpartyId') ?? '')}`;
  revalidatePath(`/tab/${tabId}`);
  revalidatePath('/people');
  revalidatePath('/add');
  return { ok: true };
}

/** Closing is filing, not settling. Nothing about what anyone owes changes —
 *  a closed tab with money still outstanding is a real and useful thing to
 *  have. A closed tab is simply not offered when adding an expense. */
export async function toggleTabClosed(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('tabId') ?? '');
  const [b] = await sql`
    update ledger_book
    set closed_at = case when closed_at is null then now() else null end
    where id = ${id} and household_id = ${actor.household_id}
    returning closed_at`;
  if (!b) return { ok: false, error: 'That tab is not one of yours.' };
  revalidatePath(`/tab/${id}`);
  revalidatePath('/people');
  revalidatePath('/add');
  return { ok: true, message: b.closed_at ? 'Closed.' : 'Reopened.' };
}

/** Only the tab goes. Its entries stay in the books with their claims, because
 *  the spending happened and the money is still owed; they just no longer
 *  have a tab to be listed under. */
export async function deleteTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('tabId') ?? '');
  const done = await sql`delete from ledger_book
    where id = ${id} and household_id = ${actor.household_id} returning id`;
  if (!done.length) return { ok: false, error: 'That tab is not one of yours.' };
  revalidatePath('/people');
  revalidatePath('/add');
  redirect('/people');
}

/* Settling up: money coming back from one person on this tab.

   It is recorded the way every repayment is — a transfer OUT of that person's
   account and INTO one of yours — because that is what happened. Not income:
   it was never spending, so recovering it is not earning. Carrying the tab's
   id is what lets the tab say what is still outstanding under it without
   guessing which of a person's debts a payment was meant for. */
export async function settleTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const tabId = String(fd.get('tabId') ?? '');
  const personId = String(fd.get('counterpartyId') ?? '');
  const [b] = await sql`select id from ledger_book
    where id = ${tabId} and household_id = ${actor.household_id}`;
  if (!b) return { ok: false, error: 'That tab is not one of yours.' };

  const [person] = await sql`select id, account_id from counterparty
    where id = ${personId} and household_id = ${actor.household_id} and archived_at is null`;
  if (!person) return { ok: false, error: 'That person is not one of yours.' };

  const on = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'That date is not valid.' };

  const [m] = await sql`
    select funding_account_id from payment_method
    where id = ${String(fd.get('methodId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null`;
  if (!m) return { ok: false, error: 'Choose where the money went.' };

  const [bal] = await sql`
    select coalesce(outstanding, 0)::bigint as outstanding from tab_balance
    where book_id = ${b.id} and counterparty_id = ${person.id}`;
  const owed = Number(bal?.outstanding ?? 0);
  if (owed <= 0) return { ok: false, error: 'They owe nothing on this tab.' };

  // Blank means "all of it": the common case should not need typing.
  const typed = amount(fd.get('amount'));
  const minor = String(fd.get('amount') ?? '').trim() === '' ? owed : typed;
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
  if (minor > owed) return { ok: false, error: 'That is more than they owe on this tab.' };

  try {
    await sql`
      insert into txn (household_id, created_by, kind, amount, occurred_on,
                       account_id, counter_account_id, book_id, source)
      values (${actor.household_id}, ${actor.user_id}, 'transfer', ${minor}, ${on}::date,
              ${person.account_id}, ${m.funding_account_id}, ${b.id}, 'manual')`;
  } catch (e) {
    const pg = e as { code?: string; constraint_name?: string };
    console.error('settleTab refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
    return { ok: false, error: 'That could not be recorded.' };
  }

  revalidatePath(`/tab/${tabId}`);
  revalidatePath('/people');
  revalidatePath(`/people/${personId}`);
  revalidatePath('/accounts');
  revalidatePath('/worth');
  revalidatePath('/');
  return { ok: true, message: minor === owed ? 'Settled up.' : 'Recorded.' };
}
