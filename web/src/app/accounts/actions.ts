'use server';

import { revalidatePath } from 'next/cache';
import { rethrowControlFlow } from '@/lib/rethrow';
import { sql, withHousehold } from '@/db/client';
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
    throw new Error('Viewers cannot change accounts.');
  }
  return actor;
}

const KINDS = ['spending', 'savings', 'credit', 'cash'] as const;
const RAILS = ['upi', 'card', 'netbanking', 'cash', 'cheque', 'wallet', 'autodebit'] as const;

/* The same rule the database enforces in method_funding_is_valid(), said here
   in words a person can act on. The trigger is what makes it true; this is
   what makes it kind. */
function railProblem(rail: string, accountKind: string): string | null {
  if (accountKind === 'person') return 'A payment method cannot draw on a person.';
  if (rail === 'card' && accountKind !== 'credit') {
    return 'A card must draw on a credit card account.';
  }
  if (rail === 'upi' && !['spending', 'cash'].includes(accountKind)) {
    return 'UPI must draw on a bank or cash account.';
  }
  if (rail === 'netbanking' && accountKind !== 'spending') {
    return 'Net banking must draw on a bank account.';
  }
  return null;
}

/** A day-of-month that exists in every month. The 31st is a trap: it silently
 *  becomes the 28th for four months of the year and nobody notices until the
 *  bill is late. */
function dayProblem(label: string, v: string): string | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 28) {
    return `${label} must be between 1 and 28 — every month has those days.`;
  }
  return null;
}

export async function addAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const name = String(fd.get('name') ?? '').trim();
    const kind = String(fd.get('kind') ?? '');
    const last4 = String(fd.get('last4') ?? '').trim() || null;

    if (name.length < 2) return { ok: false, error: 'Give the account a name.' };
    if (name.length > 60) return { ok: false, error: 'Account names are 60 characters at most.' };
    if (!(KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Choose an account type.' };
    if (last4 && !/^\d{4}$/.test(last4)) return { ok: false, error: 'Enter exactly four digits, or leave it blank.' };

    const [clash] = await sql`
      select 1 from account where household_id = ${actor.household_id}
        and lower(name) = ${name.toLowerCase()} and archived_at is null`;
    if (clash) return { ok: false, error: 'You already have an account with that name.' };

    const opening = amount(fd.get('opening'));

    if (kind === 'credit') {
      const limit = amount(fd.get('limit'));
      const statement = String(fd.get('statement_day') ?? '');
      const due = String(fd.get('due_day') ?? '');
      const bad = dayProblem('The statement day', statement) ?? dayProblem('The due day', due);
      if (bad) return { ok: false, error: bad };

      await sql`
        insert into account (household_id, name, kind, currency, last4, opening_balance,
                             credit_limit, statement_day, due_day)
        values (${actor.household_id}, ${name}, 'credit', ${actor.currency}, ${last4}, ${-Math.abs(opening)},
                ${limit || null}, ${Number(statement)}, ${Number(due)})`;
    } else {
      await sql`
        insert into account (household_id, name, kind, currency, last4, opening_balance)
        values (${actor.household_id}, ${name}, ${kind}, ${actor.currency}, ${last4}, ${opening})`;
    }

    revalidatePath('/accounts');
    return { ok: true, message: `${name} added.` };
  });
}

/* The account is the same account afterwards: same id, same kind, same
   entries. What changes is how it is described and, for a card, when its
   bills close and fall due. Kind is not editable — a bank account that became
   a credit card would have every past entry filed the wrong way round. */
export async function editAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('id') ?? '');
    const name = String(fd.get('name') ?? '').trim();
    const last4 = String(fd.get('last4') ?? '').trim() || null;

    if (name.length < 2) return { ok: false, error: 'Give the account a name.' };
    if (name.length > 60) return { ok: false, error: 'Account names are 60 characters at most.' };
    if (last4 && !/^\d{4}$/.test(last4)) return { ok: false, error: 'Enter exactly four digits, or leave it blank.' };

    // Theirs, real, and still live. A person account is never edited here: its
    // name is the person's, kept on the people screen.
    const [acc] = await sql`
      select id, kind, statement_day, due_day from account
      where id = ${id} and household_id = ${actor.household_id}
        and kind <> 'person' and archived_at is null`;
    if (!acc) return { ok: false, error: 'That account is not one of yours.' };

    const [clash] = await sql`
      select 1 from account where household_id = ${actor.household_id}
        and lower(name) = ${name.toLowerCase()} and archived_at is null and id <> ${acc.id}`;
    if (clash) return { ok: false, error: 'You already have an account with that name.' };

    const opening = amount(fd.get('opening'));

    if (acc.kind !== 'credit') {
      await sql`
        update account set name = ${name}, last4 = ${acc.kind === 'cash' ? null : last4},
                           opening_balance = ${opening}
        where id = ${acc.id} and household_id = ${actor.household_id}`;
      revalidatePath('/accounts');
      revalidatePath('/');
      return { ok: true, message: `${name} updated.` };
    }

    const limit = amount(fd.get('limit'));
    const statement = String(fd.get('statement_day') ?? '');
    const due = String(fd.get('due_day') ?? '');
    const bad = dayProblem('The statement day', statement) ?? dayProblem('The due day', due);
    if (bad) return { ok: false, error: bad };
    const sday = Number(statement), dday = Number(due);
    const datesMoved = sday !== acc.statement_day || dday !== acc.due_day;

    await sql.begin(async (tx) => {
      await tx`
        update account set name = ${name}, last4 = ${last4},
                           opening_balance = ${-Math.abs(opening)}, credit_limit = ${limit || null},
                           statement_day = ${sday}, due_day = ${dday}
        where id = ${acc.id} and household_id = ${actor.household_id}`;
      if (!datesMoved) return;

      /* The statement day decides which cycle a purchase belongs to, so moving
         it moves purchases. Every entry on a bill that has not been paid is
         re-filed by touching it: the filing trigger runs on any UPDATE and
         reads the account's days fresh. A paid bill is history and keeps what
         it had — the bank has already been paid for exactly those purchases. */
      await tx`
        update txn set occurred_on = occurred_on
        where account_id = ${acc.id}
          and (card_cycle_id is null
               or card_cycle_id in (select id from card_cycle
                                    where account_id = ${acc.id} and status <> 'paid'))`;
      // A cycle that kept its purchases still falls due on the new day.
      await tx`
        update card_cycle set due_on = cycle_due(${sday}, ${dday}, period_end)
        where account_id = ${acc.id} and status <> 'paid'`;
      // A cycle whose purchases all moved elsewhere is nothing but a date range.
      await tx`
        delete from card_cycle c
        where c.account_id = ${acc.id} and c.status <> 'paid' and c.paid_txn_id is null
          and not exists (select 1 from txn t where t.card_cycle_id = c.id)`;
    });

    revalidatePath('/accounts');
    revalidatePath('/');
    return { ok: true, message: `${name} updated.` };
  });
}

export async function archiveAccount(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');

    // Ways to pay would be left pointing at nothing, and the ledger would start
    // disagreeing with the pickers.
    const [{ n: rails }] = await sql`
      select count(*)::int as n from payment_method
      where funding_account_id = ${id} and household_id = ${actor.household_id} and archived_at is null`;
    if (rails > 0) {
      return { ok: false, error: `Archive the ${rails === 1 ? 'payment method that draws' : `${rails} payment methods that draw`} on this first.` };
    }

    /* Archived, never deleted. Entries keep pointing at it, so the months it
       appears in still add up — which is the whole reason the column exists. */
    await sql`update account set archived_at = now()
              where id = ${id} and household_id = ${actor.household_id}`;
    revalidatePath('/accounts');
    return { ok: true, message: 'Archived. Existing entries are unchanged.' };
  });
}

export async function addMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const name = String(fd.get('name') ?? '').trim();
    const rail = String(fd.get('kind') ?? '');
    const accountId = String(fd.get('funding_account_id') ?? '');
    const handle = String(fd.get('handle') ?? '').trim() || null;

    if (name.length < 2) return { ok: false, error: 'Give the payment method a name.' };
    if (!(RAILS as readonly string[]).includes(rail)) return { ok: false, error: 'Choose a payment method type.' };

    const [acc] = await sql`
      select id, kind, name from real_account
      where id = ${accountId} and household_id = ${actor.household_id} and archived_at is null`;
    if (!acc) return { ok: false, error: 'That account is not one of yours.' };

    const bad = railProblem(rail, acc.kind);
    if (bad) return { ok: false, error: bad };

    // Two payment methods with the same name are indistinguishable in the picker
    // on Add Entry, which is the one place it matters.
    const [clash] = await sql`
      select 1 from payment_method where household_id = ${actor.household_id}
        and lower(name) = ${name.toLowerCase()} and archived_at is null`;
    if (clash) return { ok: false, error: 'You already have a payment method with that name.' };

    const [{ n }] = await sql`
      select count(*)::int as n from payment_method where household_id = ${actor.household_id}`;

    try {
      await sql`
        insert into payment_method (household_id, name, kind, funding_account_id, handle, sort_order)
        values (${actor.household_id}, ${name}, ${rail}, ${acc.id}, ${handle}, ${n})`;
    } catch {
      return { ok: false, error: 'That combination is not allowed. Check which account it draws on.' };
    }

    revalidatePath('/accounts');
    revalidatePath('/add');
    return { ok: true, message: `${name} added, drawing on ${acc.name}.` };
  });
}

export async function archiveMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');

    const [{ n }] = await sql`
      select count(*)::int as n from payment_method
      where household_id = ${actor.household_id} and archived_at is null`;
    if (n <= 1) {
      return { ok: false, error: 'This is your last payment method. Add another one first.' };
    }

    await sql`update payment_method set archived_at = now(), is_default = false
              where id = ${id} and household_id = ${actor.household_id}`;
    revalidatePath('/accounts');
    revalidatePath('/add');
    return { ok: true, message: 'Archived. Existing entries are unchanged.' };
  });
}

/** Exactly one default, so Add Entry always opens on something. */
export async function makeDefaultMethod(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); } catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
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
  });
}
