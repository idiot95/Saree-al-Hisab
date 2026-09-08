'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';
import { buildRule, parseRule, nextDates, maxDay, rewriteRuleTo, ruleOf, describeRule, friendlyDate, type Calendar } from '@/lib/recur';
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
  return withHousehold(actor.household_id, async () => {

    const name = String(fd.get('name') ?? '').trim();
    if (name.length < 2) return { ok: false, error: 'Give it a name.' };
    if (name.length > 60) return { ok: false, error: 'Names are 60 characters at most.' };

    // Rent goes out; a salary comes in. The kind is fixed at creation and every
    // entry recorded from the schedule carries it, so a month's income can never
    // be booked as an expense by the reminder that raised it.
    const kind = String(fd.get('kind') ?? 'expense');
    if (kind !== 'expense' && kind !== 'income') return { ok: false, error: 'Is it paid out, or paid to you?' };

    // Which calendar the rule is written on. The Misri calendar is arithmetic,
    // so "the 1st of Ramadaan" is a date years ahead, not a sighting.
    const cal: Calendar = fd.get('calendar') === 'hijri' ? 'hijri' : 'gregorian';
    const freq = fd.get('freq') === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
    const month = Number(fd.get('month') ?? 1);
    if (freq === 'YEARLY' && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return { ok: false, error: 'Pick a month.' };
    }
    const day = Number(fd.get('day'));
    const top = maxDay(cal, freq, month);
    if (!Number.isInteger(day) || day < 1 || day > top) {
      return { ok: false, error: `Pick a day from 1 to ${top} — every ${freq === 'YEARLY' ? 'year' : 'month'} has those.` };
    }
    const base = freq === 'YEARLY'
      ? buildRule({ freq: 'YEARLY', day, month })
      : buildRule({ freq: 'MONTHLY', day });

    /* When it stops, always kept as a last date. "Five times" is turned into
       the fifth date here, so the stored rule says everything on its own and
       nothing has to count. "On a date" is taken as given, and must be ahead. */
    const ends = String(fd.get('ends') ?? 'never');
    let until: string | undefined;
    if (ends === 'after') {
      const times = Number(fd.get('times'));
      if (!Number.isInteger(times) || times < 1 || times > 600) {
        return { ok: false, error: 'How many times? From 1 to 600.' };
      }
      const dates = nextDates(base, new Date(), times, cal);
      until = dates[dates.length - 1];
      if (!until) return { ok: false, error: 'That schedule is not one we can keep.' };
    } else if (ends === 'on') {
      const on = String(fd.get('untilDate') ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(on) || Number.isNaN(Date.parse(on))) {
        return { ok: false, error: 'Pick the last date.' };
      }
      if (nextDates(base, new Date(), 1, cal)[0] > on) {
        return { ok: false, error: 'That end is before the first date — it would never happen.' };
      }
      until = on;
    } else if (ends !== 'never') {
      return { ok: false, error: 'Does it end?' };
    }
    const rule = until ? `${base};UNTIL=${until.replaceAll('-', '')}` : base;
    if (!parseRule(rule, cal)) return { ok: false, error: 'That schedule is not one we can keep.' };

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

    // The rule lands in the column for its calendar and the other stays NULL;
    // the table's CHECK insists on one of the two.
    await sql`
      insert into schedule (household_id, name, kind, amount, amount_from_statement,
                            account_id, category_id, rrule, hijri_rule)
      values (${actor.household_id}, ${name}, ${kind}, ${minor}, false,
              ${m.funding_account_id}, ${cat.id},
              ${cal === 'gregorian' ? rule : null}, ${cal === 'hijri' ? rule : null})`;

    revalidatePath('/schedules');
    revalidatePath('/inbox');
    return { ok: true, message: `${name} added.` };
  });
}

export async function archiveSchedule(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const done = await sql`
      update schedule set archived_at = now()
      where id = ${String(fd.get('scheduleId') ?? '')} and household_id = ${actor.household_id}
        and archived_at is null returning id`;
    if (!done.length) return { ok: false, error: 'That schedule is not one of yours.' };
    revalidatePath('/schedules');
    revalidatePath('/inbox');
    return { ok: true, message: 'Stopped. Entries already recorded are untouched.' };
  });
}

/* Recording a due writes the entry AND the occurrence together, so a schedule
   can never show as paid without something in the ledger to show for it — the
   paid_has_txn constraint refuses it outright. */
export async function recordDue(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const scheduleId = String(fd.get('scheduleId') ?? '');
    const dueOn = String(fd.get('dueOn') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: 'That date is not valid.' };

    const [s] = await sql`
      select s.id, s.name, s.kind, s.amount::bigint, s.account_id, s.category_id,
             to_char(o.shifted_to, 'YYYY-MM-DD') as shifted_to
      from schedule s
      left join occurrence o on o.schedule_id = s.id and o.due_on = ${dueOn}::date
      where s.id = ${scheduleId} and s.household_id = ${actor.household_id} and s.archived_at is null`;
    if (!s) return { ok: false, error: 'That schedule is not one of yours.' };

    const typed = amount(fd.get('amount'));
    const minor = typed > 0 ? typed : Number(s.amount);
    if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };

    // A due that was moved is recorded on the day it was moved to. The
    // occurrence keeps the rule's date as its identity, and keeps the move.
    const on = s.shifted_to ?? dueOn;
    try {
      await sql.begin(async (tx) => {
        const [t] = await tx`
          insert into txn (household_id, created_by, kind, amount, occurred_on,
                           account_id, category_id, merchant, source)
          values (${actor.household_id}, ${actor.user_id}, ${s.kind}, ${minor}, ${on}::date,
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
  });
}

/** Skipping writes an occurrence with no entry — which is the honest record of
 *  a month where the thing did not happen. */
export async function skipDue(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

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
  });
}

/* "Not the 5th this month — the 10th." The occurrence keeps the rule's date
   and records where it went, so the calendar can draw the move and the due
   is owed on the new day. Asked to make it permanent, the rule itself is
   rewritten to that day, from that day: months already recorded stay as
   they were, and the dates the new rule would put before it are not owed. */
export async function moveDue(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const dueOn = String(fd.get('dueOn') ?? '');
    const to = String(fd.get('to') ?? '');
    const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    if (!isDay(dueOn)) return { ok: false, error: 'That date is not valid.' };
    if (!isDay(to)) return { ok: false, error: 'Pick the day it moves to.' };
    if (to === dueOn) return { ok: false, error: 'That is the day it is already on.' };
    const gap = Math.round((Date.parse(to) - Date.parse(dueOn)) / 86400000);
    if (gap < -30 || gap > 90) {
      return { ok: false, error: 'A move is a nudge — up to a month earlier or three months later. For more than that, stop the schedule and make a new one.' };
    }

    const [s] = await sql`
      select s.id, s.name, s.rrule, s.hijri_rule, o.status
      from schedule s
      left join occurrence o on o.schedule_id = s.id and o.due_on = ${dueOn}::date
      where s.id = ${String(fd.get('scheduleId') ?? '')} and s.household_id = ${actor.household_id}
        and s.archived_at is null`;
    if (!s) return { ok: false, error: 'That schedule is not one of yours.' };
    if (s.status === 'paid') return { ok: false, error: 'That one is already recorded as paid.' };
    if (s.status === 'skipped') return { ok: false, error: 'That one was skipped. Nothing to move.' };

    const r = ruleOf({ rrule: s.rrule as string | null, hijri_rule: s.hijri_rule as string | null });
    if (!r) return { ok: false, error: 'That schedule has no rule to move.' };

    if (fd.get('permanent') !== 'yes') {
      await sql`
        insert into occurrence (schedule_id, due_on, status, shifted_to)
        values (${s.id}, ${dueOn}::date, 'pending', ${to}::date)
        on conflict (schedule_id, due_on) do update set shifted_to = excluded.shifted_to`;
      revalidatePath('/schedules'); revalidatePath('/inbox'); revalidatePath('/');
      return { ok: true, message: `${s.name} moved to ${friendlyDate(to)}, this once.` };
    }

    const next = rewriteRuleTo(r.rule, r.cal, to);
    if (!next) {
      return { ok: false, error: r.cal === 'hijri'
        ? 'Not every Hijri month has that day, so it cannot be the day every time. Move just this one instead.'
        : 'Not every month has that day, so it cannot be the day every time. Move just this one instead.' };
    }
    await sql.begin(async (tx) => {
      // The new rule puts a due on `to` by itself; a pending move would only
      // double it. Recorded rows are history and are left alone.
      await tx`delete from occurrence where schedule_id = ${s.id} and due_on = ${dueOn}::date and status = 'pending'`;
      await tx`
        update schedule set rrule = ${r.cal === 'gregorian' ? next : null},
                            hijri_rule = ${r.cal === 'hijri' ? next : null},
                            rule_since = ${to}::date
        where id = ${s.id} and household_id = ${actor.household_id}`;
    });
    revalidatePath('/schedules'); revalidatePath('/inbox'); revalidatePath('/');
    return { ok: true, message: `${s.name} is now ${describeRule(next, r.cal)}, from ${friendlyDate(to)}.` };
  });
}
