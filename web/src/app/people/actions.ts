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
const RELATIONSHIPS = ['family', 'friend', 'work', 'vendor'] as const;
const TINTS = ['green', 'orange', 'blue', 'purple', 'pink', 'cyan', 'rust', 'indigo'];

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change the ledger.');
  return actor;
}

/* A person IS an account underneath — that is what makes "what Ahmed owes" the
   same kind of figure as "what is in the bank", computed the same way from the
   same entries rather than tallied separately and left to drift. The account is
   of kind 'person', which keeps it out of every picker and every balance
   total. */
export async function addPerson(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  const phone = String(fd.get('phone') ?? '').trim() || null;
  const relationship = String(fd.get('relationship') ?? 'friend');

  if (name.length < 2) return { ok: false, error: 'Give the person a name.' };
  if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };
  if (!(RELATIONSHIPS as readonly string[]).includes(relationship)) {
    return { ok: false, error: 'Choose how you know them.' };
  }

  const [clash] = await sql`
    select 1 from counterparty
    where household_id = ${actor.household_id} and lower(name) = ${name.toLowerCase()}
      and archived_at is null`;
  if (clash) return { ok: false, error: 'You already have someone by that name.' };

  const [{ n }] = await sql`
    select count(*)::int as n from counterparty where household_id = ${actor.household_id}`;

  await sql.begin(async (tx) => {
    const [a] = await tx`
      insert into account (household_id, name, kind, opening_balance)
      values (${actor.household_id}, ${name}, 'person', 0) returning id`;
    await tx`
      insert into counterparty (household_id, name, phone, relationship, tint, account_id)
      values (${actor.household_id}, ${name}, ${phone}, ${relationship},
              ${TINTS[n % TINTS.length]}, ${a.id})`;
  });

  revalidatePath('/people');
  return { ok: true, message: `${name} added.` };
}

async function personAccount(householdId: string, id: string) {
  const [p] = await sql`
    select c.id, c.name, c.account_id from counterparty c
    where c.id = ${id} and c.household_id = ${householdId} and c.archived_at is null`;
  return p as undefined | { id: string; name: string; account_id: string };
}

async function fundingAccount(householdId: string, methodId: string) {
  const [m] = await sql`
    select funding_account_id from payment_method
    where id = ${methodId} and household_id = ${householdId} and archived_at is null`;
  return m?.funding_account_id as string | undefined;
}

/* Lending is a TRANSFER, not spending. The money has not gone anywhere: it has
   moved from your account into theirs, and the ledger says so. This is the
   whole reason a person is modelled as an account. */
export async function lend(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const person = await personAccount(actor.household_id, String(fd.get('personId') ?? ''));
  if (!person) return { ok: false, error: 'That person is not one of yours.' };

  const minor = amount(fd.get('amount'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
  const on = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'That date is not valid.' };

  const from = await fundingAccount(actor.household_id, String(fd.get('methodId') ?? ''));
  if (!from) return { ok: false, error: 'Choose where the money came from.' };

  await sql`
    insert into txn (household_id, created_by, kind, amount, occurred_on,
                     account_id, counter_account_id, payment_method_id, note, source)
    values (${actor.household_id}, ${actor.user_id}, 'transfer', ${minor}, ${on}::date,
            ${from}, ${person.account_id}, ${String(fd.get('methodId'))},
            ${String(fd.get('note') ?? '').trim() || null}, 'manual')`;

  revalidatePath('/people');
  revalidatePath('/accounts');
  redirect(`/people/${person.id}`);
}

/** Money coming back. Also a transfer — it was never spending, so getting it
 *  back is not income. */
export async function recordRepayment(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const person = await personAccount(actor.household_id, String(fd.get('personId') ?? ''));
  if (!person) return { ok: false, error: 'That person is not one of yours.' };

  const minor = amount(fd.get('amount'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
  const on = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'That date is not valid.' };

  const into = await fundingAccount(actor.household_id, String(fd.get('methodId') ?? ''));
  if (!into) return { ok: false, error: 'Choose where the money went.' };

  await sql`
    insert into txn (household_id, created_by, kind, amount, occurred_on,
                     account_id, counter_account_id, note, source)
    values (${actor.household_id}, ${actor.user_id}, 'transfer', ${minor}, ${on}::date,
            ${person.account_id}, ${into},
            ${String(fd.get('note') ?? '').trim() || null}, 'manual')`;

  revalidatePath('/people');
  revalidatePath('/accounts');
  redirect(`/people/${person.id}`);
}

/* Forgiving a debt is spending, on the day you forgive it. Until then the
   money was still yours, sitting in someone else's pocket; the moment you
   write it off it has been spent, and it needs a category like anything else. */
export async function writeOff(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const person = await personAccount(actor.household_id, String(fd.get('personId') ?? ''));
  if (!person) return { ok: false, error: 'That person is not one of yours.' };

  const minor = amount(fd.get('amount'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
  const on = String(fd.get('occurred_on') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'That date is not valid.' };

  const [cat] = await sql`
    select id from category
    where id = ${String(fd.get('categoryId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null`;
  if (!cat) return { ok: false, error: 'Choose which category to count it under.' };

  await sql`
    insert into txn (household_id, created_by, kind, amount, occurred_on,
                     account_id, category_id, merchant, note, source)
    values (${actor.household_id}, ${actor.user_id}, 'expense', ${minor}, ${on}::date,
            ${person.account_id}, ${cat.id}, ${'Written off — ' + person.name},
            ${String(fd.get('note') ?? '').trim() || null}, 'manual')`;

  revalidatePath('/people');
  revalidatePath('/');
  redirect(`/people/${person.id}`);
}
