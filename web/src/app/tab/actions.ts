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

/* A tab is a few people who owe you back — the flat, a trip, the office
   petrol, the medical bills an insurer reimburses. A cost put on it raises one
   claim per person the moment it is saved, and the tab's screen adds those up
   and records the money coming back. Whether the cost was YOUR spending is a
   separate question the tab answers by default and the entry can override.
   Every action here re-checks that the tab and the person belong to the
   household asking, because a hidden button is not a rule. */
export async function createTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const note = String(fd.get('note') ?? '').trim() || null;
  const counts = fd.get('countsAsSpending') === 'yes';

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
      insert into ledger_book (household_id, name, note, counts_as_spending)
      values (${actor.household_id}, ${name}, ${note}, ${counts}) returning id`;
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
    update ledger_book
    set name = ${name}, note = ${note},
        counts_as_spending = ${fd.get('countsAsSpending') === 'yes'}
    where id = ${id} and household_id = ${actor.household_id} returning id`;
  if (!done.length) return { ok: false, error: 'That tab is not one of yours.' };
  revalidatePath(`/tab/${id}`);
  revalidatePath('/people');
  revalidatePath('/add');
  return { ok: true, message: 'Saved. Entries already recorded keep what they say.' };
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
 *  from now on. What they already owe stays owed — the money was really spent
 *  on their behalf, and leaving the tab does not unspend it. */
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

   Recorded the way every reimbursement is — a claim_receipt per claim, which
   is what claim_state derives "received" from. A single amount is spread
   across that person's open claims on this tab oldest first, so a part payment
   clears the oldest entries whole and leaves the newest partly owed, and every
   receipt is written in one transaction: either the whole settlement is in the
   books or none of it is. Money arriving against a claim is in neither
   spend_txn nor income_txn — it is not earning, and it does not reduce what
   the month cost. */
export async function settleTab(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const tabId = String(fd.get('tabId') ?? '');
  const personId = String(fd.get('counterpartyId') ?? '');
  const [b] = await sql`select id from ledger_book
    where id = ${tabId} and household_id = ${actor.household_id}`;
  if (!b) return { ok: false, error: 'That tab is not one of yours.' };

  const on = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'That date is not valid.' };

  const [m] = await sql`
    select funding_account_id from payment_method
    where id = ${String(fd.get('methodId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null`;
  if (!m) return { ok: false, error: 'Choose where the money went.' };

  const open = await sql`
    select cs.id, cs.outstanding::bigint
    from claim_state cs
    join txn t on t.id = cs.txn_id and t.deleted_at is null
    where cs.household_id = ${actor.household_id} and cs.counterparty_id = ${personId}
      and t.book_id = ${b.id} and cs.status in ('open', 'part_paid')
    order by t.occurred_on, t.created_at`;
  const owed = open.reduce((n, c) => n + Number(c.outstanding), 0);
  if (owed <= 0) return { ok: false, error: 'They owe nothing on this tab.' };

  // Blank means "all of it": the common case should not need typing.
  const typed = amount(fd.get('amount'));
  const minor = String(fd.get('amount') ?? '').trim() === '' ? owed : typed;
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
  if (minor > owed) return { ok: false, error: 'That is more than they owe on this tab.' };

  try {
    await sql.begin(async (tx) => {
      let left = minor;
      for (const c of open) {
        if (left <= 0) break;
        const part = Math.min(left, Number(c.outstanding));
        await tx`
          insert into txn (household_id, created_by, kind, amount, occurred_on,
                           account_id, claim_id, source)
          values (${actor.household_id}, ${actor.user_id}, 'claim_receipt', ${part}, ${on}::date,
                  ${m.funding_account_id}, ${c.id}, 'manual')`;
        left -= part;
      }
    });
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
