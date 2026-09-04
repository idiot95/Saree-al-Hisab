'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';

/** People type ₹ and commas. Keep the digits and the point, discard the theatre. */
const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/* Reachable by direct POST, so each one re-establishes who is asking and
   re-checks that every id belongs to their household. A viewer is stopped
   here rather than by hiding buttons. */
async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') {
    throw new Error('You are here to look, not to rearrange the furniture.');
  }
  return actor;
}

const KINDS = ['spending', 'savings', 'credit', 'cash'] as const;
const RAILS = ['upi', 'card', 'netbanking', 'cash', 'cheque', 'wallet', 'autodebit'] as const;

/* The same rule the database enforces in method_funding_is_valid(), said here
   in words a person can act on. The trigger is what makes it true; this is
   what makes it kind. */
function railProblem(rail: string, accountKind: string): string | null {
  if (accountKind === 'person') return 'You cannot pay out of a person.';
  if (rail === 'card' && accountKind !== 'credit') {
    return 'A card has to draw on a credit card account. That is rather the point of it.';
  }
  if (rail === 'upi' && !['spending', 'cash'].includes(accountKind)) {
    return 'UPI draws on a bank or cash account, never on a credit card.';
  }
  if (rail === 'netbanking' && accountKind !== 'spending') {
    return 'Net banking needs a bank account behind it.';
  }
  return null;
}

/** A day-of-month that exists in every month. The 31st is a trap: it silently
 *  becomes the 28th for four months of the year and nobody notices until the
 *  bill is late. */
function dayProblem(label: string, v: string): string | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 28) {
    return `${label} has to be a day from 1 to 28 — every month has those, and the 31st does not.`;
  }
  return null;
}

export async function addAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const kind = String(fd.get('kind') ?? '');
  const last4 = String(fd.get('last4') ?? '').trim() || null;

  if (name.length < 2) return { ok: false, error: 'Give it a name you will recognise in a hurry.' };
  if (name.length > 60) return { ok: false, error: 'Sixty characters. It is a bank account, not a poem.' };
  if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Pick what sort of account it is.' };
  if (last4 && !/^\d{4}$/.test(last4)) return { ok: false, error: 'Last four digits means four digits.' };

  const [clash] = await sql`
    select 1 from account where household_id = ${actor.household_id}
      and lower(name) = ${name.toLowerCase()} and archived_at is null`;
  if (clash) return { ok: false, error: 'You already have one by that name. Two would only confuse you.' };

  const opening = amount(fd.get('opening'));

  if (kind === 'credit') {
    const limit = amount(fd.get('limit'));
    const statement = String(fd.get('statement_day') ?? '');
    const due = String(fd.get('due_day') ?? '');
    const bad = dayProblem('The statement day', statement) ?? dayProblem('The due day', due);
    if (bad) return { ok: false, error: bad };

    await sql`
      insert into account (household_id, name, kind, last4, opening_balance,
                           credit_limit, statement_day, due_day)
      values (${actor.household_id}, ${name}, 'credit', ${last4}, ${-Math.abs(opening)},
              ${limit || null}, ${Number(statement)}, ${Number(due)})`;
  } else {
    await sql`
      insert into account (household_id, name, kind, last4, opening_balance)
      values (${actor.household_id}, ${name}, ${kind}, ${last4}, ${opening})`;
  }

  revalidatePath('/accounts');
  return { ok: true, message: `${name} is on the books.` };
}

export async function archiveAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('id') ?? '');

  // Ways to pay would be left pointing at nothing, and the ledger would start
  // disagreeing with the pickers.
  const [{ n: rails }] = await sql`
    select count(*)::int as n from payment_method
    where funding_account_id = ${id} and archived_at is null`;
  if (rails > 0) {
    return { ok: false, error: `Something still pays out of this. Retire the ${rails === 1 ? 'way to pay' : `${rails} ways to pay`} first.` };
  }

  /* Archived, never deleted. Entries keep pointing at it, so the months it
     appears in still add up — which is the whole reason the column exists. */
  await sql`update account set archived_at = now()
            where id = ${id} and household_id = ${actor.household_id}`;
  revalidatePath('/accounts');
  return { ok: true, message: 'Tucked away. Old entries still remember it.' };
}

export async function addMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const rail = String(fd.get('kind') ?? '');
  const accountId = String(fd.get('funding_account_id') ?? '');
  const handle = String(fd.get('handle') ?? '').trim() || null;

  if (name.length < 2) return { ok: false, error: 'Name it something you would recognise at a till.' };
  if (!(RAILS as readonly string[]).includes(rail)) return { ok: false, error: 'Pick how the money actually travels.' };

  const [acc] = await sql`
    select id, kind, name from real_account
    where id = ${accountId} and household_id = ${actor.household_id} and archived_at is null`;
  if (!acc) return { ok: false, error: 'That is not one of your accounts.' };

  const bad = railProblem(rail, acc.kind);
  if (bad) return { ok: false, error: bad };

  const [{ n }] = await sql`
    select count(*)::int as n from payment_method where household_id = ${actor.household_id}`;

  try {
    await sql`
      insert into payment_method (household_id, name, kind, funding_account_id, handle, sort_order)
      values (${actor.household_id}, ${name}, ${rail}, ${acc.id}, ${handle}, ${n})`;
  } catch {
    return { ok: false, error: 'The database refused that pairing. Check what it draws on.' };
  }

  revalidatePath('/accounts');
  revalidatePath('/add');
  return { ok: true, message: `${name} now comes out of ${acc.name}.` };
}

export async function archiveMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('id') ?? '');

  const [{ n }] = await sql`
    select count(*)::int as n from payment_method
    where household_id = ${actor.household_id} and archived_at is null`;
  if (n <= 1) {
    return { ok: false, error: 'That is your last way to pay. Add another before retiring this one.' };
  }

  await sql`update payment_method set archived_at = now(), is_default = false
            where id = ${id} and household_id = ${actor.household_id}`;
  revalidatePath('/accounts');
  revalidatePath('/add');
  return { ok: true, message: 'Retired. Entries that used it are untouched.' };
}

/** Exactly one default, so Add Entry always opens on something. */
export async function makeDefaultMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('id') ?? '');

  await sql.begin(async (tx) => {
    await tx`update payment_method set is_default = false
             where household_id = ${actor.household_id}`;
    await tx`update payment_method set is_default = true
             where id = ${id} and household_id = ${actor.household_id} and archived_at is null`;
  });
  revalidatePath('/accounts');
  revalidatePath('/add');
  return { ok: true };
}
