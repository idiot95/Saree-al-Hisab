'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const KINDS = ['loan', 'reimbursement'] as const;

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change books.');
  return actor;
}

/* A book is a folder for people — "the Pune flat", "office lunches" — so that
   a household can answer "where do we stand on X" without adding up rows in
   its head. It groups people; it does not own entries, and nothing about the
   arithmetic changes by putting someone in one. */
export async function createBook(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const kind = String(fd.get('kind') ?? '');
  const note = String(fd.get('note') ?? '').trim() || null;

  if (name.length < 2) return { ok: false, error: 'Give the book a name.' };
  if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Choose what sort of book it is.' };

  const [clash] = await sql`
    select 1 from ledger_book
    where household_id = ${actor.household_id} and lower(name) = ${name.toLowerCase()}`;
  if (clash) return { ok: false, error: 'You already have a book by that name.' };

  const [b] = await sql`
    insert into ledger_book (household_id, kind, name, note)
    values (${actor.household_id}, ${kind}, ${name}, ${note}) returning id`;

  revalidatePath('/people');
  redirect(`/books/${b.id}`);
}

export async function renameBook(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('bookId') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const note = String(fd.get('note') ?? '').trim() || null;
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: 'Use between 2 and 60 characters.' };
  }
  await sql`
    update ledger_book set name = ${name}, note = ${note}
    where id = ${id} and household_id = ${actor.household_id}`;
  revalidatePath(`/books/${id}`);
  revalidatePath('/people');
  return { ok: true, message: 'Saved.' };
}

export async function addToBook(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const bookId = String(fd.get('bookId') ?? '');
  const personId = String(fd.get('counterpartyId') ?? '');

  // Both ids are checked against this household before they are joined, or a
  // book here could be pointed at a person there.
  const [b] = await sql`select id from ledger_book
    where id = ${bookId} and household_id = ${actor.household_id}`;
  const [p] = await sql`select id from counterparty
    where id = ${personId} and household_id = ${actor.household_id} and archived_at is null`;
  if (!b || !p) return { ok: false, error: 'That is not one of yours.' };

  await sql`insert into book_member (book_id, counterparty_id)
            values (${b.id}, ${p.id}) on conflict do nothing`;
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/people');
  return { ok: true };
}

/** Taking someone out of a book removes them from the folder and nothing else.
 *  What they owe is unchanged — it was never the book's to hold. */
export async function removeFromBook(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const bookId = String(fd.get('bookId') ?? '');
  const [b] = await sql`select id from ledger_book
    where id = ${bookId} and household_id = ${actor.household_id}`;
  if (!b) return { ok: false, error: 'That book is not one of yours.' };
  await sql`delete from book_member
            where book_id = ${b.id} and counterparty_id = ${String(fd.get('counterpartyId') ?? '')}`;
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/people');
  return { ok: true };
}

/** Closing is filing, not settling. Balances are untouched — a closed book
 *  with money still outstanding is a real and useful thing to have. */
export async function toggleBookClosed(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('bookId') ?? '');
  const [b] = await sql`
    update ledger_book
    set closed_at = case when closed_at is null then now() else null end
    where id = ${id} and household_id = ${actor.household_id}
    returning closed_at`;
  if (!b) return { ok: false, error: 'That book is not one of yours.' };
  revalidatePath(`/books/${id}`);
  revalidatePath('/people');
  return { ok: true, message: b.closed_at ? 'Closed.' : 'Reopened.' };
}

export async function deleteBook(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('bookId') ?? '');
  const done = await sql`delete from ledger_book
    where id = ${id} and household_id = ${actor.household_id} returning id`;
  if (!done.length) return { ok: false, error: 'That book is not one of yours.' };
  revalidatePath('/people');
  redirect('/people');
}
