'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';
import { buildRule, parseRule, MAX_DAY } from '@/lib/recur';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change schedules.');
  return actor;
}

export async function createSchedule(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const name = String(fd.get('name') ?? '').trim();
  if (name.length < 2) return { ok: false, error: 'Give it a name.' };
  if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };

  // Rent goes out; a salary comes in. The kind is fixed at creation and every
  // entry recorded from the schedule carries it, so a month's income can never
  // be booked as an expense by the reminder that raised it.
  const kind = String(fd.get('kind') ?? 'expense');
  if (kind !== 'expense' && kind !== 'income') return { ok: false, error: 'Is it paid out, or paid to you?' };

  const day = Number(fd.get('day'));
  if (!Number.isInteger(day) || day < 1 || day > MAX_DAY) {
    return { ok: false, error: `Pick a day from 1 to ${MAX_DAY} — every month has those.` };
  }
  const freq = String(fd.get('freq') ?? 'MONTHLY');
  const month = Number(fd.get('month') ?? 1);
  const rule = freq === 'YEARLY'
    ? buildRule({ freq: 'YEARLY', day, month })
    : buildRule({ freq: 'MONTHLY', day });
  if (!parseRule(rule)) return { ok: false, error: 'That schedule is not one we can keep.' };

  const minor = amount(fd.get('amount'));
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };

  // The method decides the account, exactly as it does everywhere else.
  const [m] = await sql`
    select funding_account_id from payment_method
    where id = ${String(fd.get('methodId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null`;
  if (!m) return { ok: false, error: kind === 'income' ? 'Choose where it arrives.' : 'Choose how it is paid.' };

  const [cat] = await sql`
    select id from category
    where id = ${String(fd.get('categoryId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null`;
  if (!cat) return { ok: false, error: 'Choose a category.' };

  await sql`
    insert into schedule (household_id, name, kind, amount, amount_from_statement,
                          account_id, category_id, rrule)
    values (${actor.household_id}, ${name}, ${kind}, ${minor}, false,
            ${m.funding_account_id}, ${cat.id}, ${rule})`;

  revalidatePath('/schedules');
  revalidatePath('/inbox');
  return { ok: true, message: `${name} added.` };
}

export async function archiveSchedule(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const done = await sql`
    update schedule set archived_at = now()
    where id = ${String(fd.get('scheduleId') ?? '')} and household_id = ${actor.household_id}
      and archived_at is null returning id`;
  if (!done.length) return { ok: false, error: 'That schedule is not one of yours.' };
  revalidatePath('/schedules');
  revalidatePath('/inbox');
  return { ok: true, message: 'Stopped. Entries already recorded are untouched.' };
}

/* Recording a due writes the entry AND the occurrence together, so a schedule
   can never show as paid without something in the ledger to show for it — the
   paid_has_txn constraint refuses it outright. */
export async function recordDue(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const scheduleId = String(fd.get('scheduleId') ?? '');
  const dueOn = String(fd.get('dueOn') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: 'That date is not valid.' };

  const [s] = await sql`
    select id, name, kind, amount::bigint, account_id, category_id from schedule
    where id = ${scheduleId} and household_id = ${actor.household_id} and archived_at is null`;
  if (!s) return { ok: false, error: 'That schedule is not one of yours.' };

  const typed = amount(fd.get('amount'));
  const minor = typed > 0 ? typed : Number(s.amount);
  if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };

  try {
    await sql.begin(async (tx) => {
      const [t] = await tx`
        insert into txn (household_id, created_by, kind, amount, occurred_on,
                         account_id, category_id, merchant, source)
        values (${actor.household_id}, ${actor.user_id}, ${s.kind}, ${minor}, ${dueOn}::date,
                ${s.account_id}, ${s.category_id}, ${s.name}, 'manual')
        returning id`;
      await tx`
        insert into occurrence (schedule_id, due_on, status, txn_id)
        values (${s.id}, ${dueOn}::date, 'paid', ${t.id})
        on conflict (schedule_id, due_on) do update
          set status = 'paid', txn_id = excluded.txn_id`;
    });
  } catch {
    return { ok: false, error: 'That could not be recorded.' };
  }

  revalidatePath('/schedules');
  revalidatePath('/inbox');
  revalidatePath('/');
  revalidatePath('/entries');
  return { ok: true, message: 'Recorded.' };
}

/** Skipping writes an occurrence with no entry — which is the honest record of
 *  a month where the thing did not happen. */
export async function skipDue(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const dueOn = String(fd.get('dueOn') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: 'That date is not valid.' };
  const [s] = await sql`
    select id from schedule
    where id = ${String(fd.get('scheduleId') ?? '')} and household_id = ${actor.household_id}`;
  if (!s) return { ok: false, error: 'That schedule is not one of yours.' };

  await sql`
    insert into occurrence (schedule_id, due_on, status)
    values (${s.id}, ${dueOn}::date, 'skipped')
    on conflict (schedule_id, due_on) do update set status = 'skipped', txn_id = null`;

  revalidatePath('/schedules');
  revalidatePath('/inbox');
  return { ok: true, message: 'Skipped.' };
}
