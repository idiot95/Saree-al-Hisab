'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import type { TransactionSql } from 'postgres';
import { currentActor } from '@/db/queries';
import { fromKeys } from '@/lib/money';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/** People type ₹ and commas. Keep the digits and the point. */
const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

const MONTH = /^\d{4}-\d{2}-01$/;

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change the budget.');
  return actor;
}

/* Editing September must never rewrite what August was. Budgets are one row
   per category per month, keyed on the first — so every write here is scoped
   to a single month and touches nothing before it. */
export async function saveBudget(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const month = String(fd.get('month') ?? '');
    if (!MONTH.test(month)) return { ok: false, error: 'That is not a month.' };

    // A line belongs to a parent; a child rolls up into it (the trigger in
    // 0108 refuses a child's budget row, and the form never offers one).
    const categories = await sql`
      select id from category
      where household_id = ${actor.household_id} and archived_at is null and parent_id is null
        and scope <> 'income'`;

    const rows: { category_id: string; amount: number }[] = [];
    for (const c of categories) {
      const raw = fd.get(`c_${c.id}`);
      if (raw === null) continue;
      const minor = amount(raw);
      if (!Number.isSafeInteger(minor) || minor < 0) {
        return { ok: false, error: 'One of those amounts is not a number.' };
      }
      if (minor > 1_000_000_000_00) return { ok: false, error: 'That is more than the app can hold.' };
      rows.push({ category_id: c.id as string, amount: minor });
    }

    await sql.begin(async (tx) => {
      for (const r of rows) {
        if (r.amount === 0) {
          await tx`delete from budget
                   where household_id = ${actor.household_id}
                     and category_id = ${r.category_id} and month = ${month}::date`;
        } else {
          await tx`
            insert into budget (household_id, category_id, month, amount)
            values (${actor.household_id}, ${r.category_id}, ${month}::date, ${r.amount})
            on conflict (category_id, month) do update set amount = excluded.amount`;
        }
      }
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: 'Budget saved.' };
  });
}

/** Start this month as a copy of the last one that had a budget. Existing
 *  rows for this month are left alone, so it can never overwrite work. */
export async function copyPreviousMonth(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const month = String(fd.get('month') ?? '');
    if (!MONTH.test(month)) return { ok: false, error: 'That is not a month.' };

    const [prev] = await sql`
      select month from budget
      where household_id = ${actor.household_id} and month < ${month}::date
      order by month desc limit 1`;
    if (!prev) return { ok: false, error: 'There is no earlier month to copy.' };

    const done = await sql`
      insert into budget (household_id, category_id, month, amount)
      select household_id, category_id, ${month}::date, amount
      from budget
      where household_id = ${actor.household_id} and month = ${prev.month}
      on conflict (category_id, month) do nothing
      returning category_id`;

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `Copied ${done.length} ${done.length === 1 ? 'category' : 'categories'}.` };
  });
}

/* Budgets you can name, switch between, and come back to.

   A budget is a named set of lines — a figure per category — and a range of
   months. Exactly one is current, which Postgres enforces with a partial
   unique index rather than this code remembering to.

   Making one current MATERIALISES it: `budget` (a row per category per month)
   is what every screen reads, and the set writes those rows across the months
   it covers. Two rules make that predictable:

   1. It writes from THIS MONTH FORWARD only. A month already spent against is
      history, and a budget adopted today did not apply in March.
   2. Before writing, it clears the future months of whatever was current
      before, so switching does not leave the old budget's figures stranded in
      months the new one does not mention.

   Putting a budget away is just making another one current. Nothing is lost:
   the set keeps every line it had, which is the whole point. */
const MONTH_ONLY = /^\d{4}-\d{2}$/;
/* Ten years. Long enough for "until the loan is paid", short enough that a
   typo cannot write a hundred thousand rows. */
const MAX_MONTHS = 120;
const UUID = /^[0-9a-f-]{36}$/;

const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

type Bad = { error: string };
type Head = { name: string; starts: string; ends: string; months: number };
type Lines = { lines: { id: string; amount: number }[] };

/** Read the name, range and per-category figures off a budget form. */
function readSet(fd: FormData): Bad | Head {
  const name = String(fd.get('name') ?? '').trim();
  if (name.length < 1 || name.length > 60) return { error: 'Give the budget a name.' };
  const from = String(fd.get('from') ?? '');
  const to = String(fd.get('to') ?? '');
  if (!MONTH_ONLY.test(from) || !MONTH_ONLY.test(to)) return { error: 'Give a first and a last month.' };
  if (to < from) return { error: 'The last month comes before the first.' };
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
    + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
  if (months > MAX_MONTHS) return { error: 'A budget runs for ten years at most.' };
  return { name, starts: `${from}-01`, ends: `${to}-01`, months };
}

/** The figures on the form, checked against the household's own categories. */
async function readLines(householdId: string, fd: FormData): Promise<Bad | Lines> {
  const spendable = await sql`
    select id, name from category
    where household_id = ${householdId} and archived_at is null and scope <> 'income'`;
  const lines: { id: string; amount: number }[] = [];
  for (const c of spendable) {
    const raw = fd.get(`c_${c.id}`);
    if (raw === null || String(raw).trim() === '') continue;
    const minor = amount(raw);
    if (!Number.isSafeInteger(minor) || minor < 0) return { error: `${c.name} is not a number.` };
    if (minor > 1_000_000_000_00) return { error: 'That is more than the app can hold.' };
    if (minor > 0) lines.push({ id: c.id as string, amount: minor });
  }
  if (lines.length === 0) return { error: 'Give at least one category an amount.' };
  return { lines };
}

/* Write a set across the months it covers, from this month forward, having
   first cleared the future of whatever was there. Runs inside a transaction
   the caller owns, so a half-applied switch is not a state anybody can see. */
async function materialise(tx: TransactionSql, householdId: string, setId: string) {
  const [set] = await tx`
    select starts_on, ends_on from budget_set
    where id = ${setId} and household_id = ${householdId}`;
  if (!set) return;
  const from = thisMonth();
  await tx`delete from budget
           where household_id = ${householdId} and month >= ${from}::date`;
  await tx`
    insert into budget (household_id, category_id, month, amount)
    select ${householdId}, l.category_id, m::date, l.amount
    from budget_line l,
         generate_series(greatest(${set.starts_on}::date, ${from}::date), ${set.ends_on}::date,
                         interval '1 month') m
    where l.set_id = ${setId}
    on conflict (category_id, month) do update set amount = excluded.amount`;
}

export async function createBudgetSet(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const head = readSet(fd);
    if ('error' in head) return { ok: false, error: head.error };
    const body = await readLines(actor.household_id, fd);
    if ('error' in body) return { ok: false, error: body.error };
    /* An unchecked box sends nothing at all, so the presence of the value is
       the answer — reading it as "not no" would have made every budget
       current, including the ones written for next year. */
    const makeCurrent = fd.get('current') === 'yes';

    await sql.begin(async (tx) => {
      if (makeCurrent) {
        await tx`update budget_set set current_at = null
                 where household_id = ${actor.household_id} and current_at is not null`;
      }
      const [set] = await tx`
        insert into budget_set (household_id, name, starts_on, ends_on, current_at)
        values (${actor.household_id}, ${head.name}, ${head.starts}::date, ${head.ends}::date,
                ${makeCurrent ? new Date() : null})
        returning id`;
      for (const l of body.lines) {
        await tx`insert into budget_line (set_id, category_id, amount)
                 values (${set.id}, ${l.id}, ${l.amount})`;
      }
      if (makeCurrent) await materialise(tx, actor.household_id, set.id as string);
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `${head.name} created.` };
  });
}

export async function updateBudgetSet(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    if (!UUID.test(id)) return { ok: false, error: 'That budget could not be read.' };
    const head = readSet(fd);
    if ('error' in head) return { ok: false, error: head.error };
    const body = await readLines(actor.household_id, fd);
    if ('error' in body) return { ok: false, error: body.error };

    const [set] = await sql`
      select id, current_at from budget_set
      where id = ${id} and household_id = ${actor.household_id}`;
    if (!set) return { ok: false, error: 'That budget is not one of yours.' };

    await sql.begin(async (tx) => {
      await tx`update budget_set set name = ${head.name},
                 starts_on = ${head.starts}::date, ends_on = ${head.ends}::date
               where id = ${id} and household_id = ${actor.household_id}`;
      // Replaced wholesale: a line removed from the form is a line removed.
      await tx`delete from budget_line where set_id = ${id}`;
      for (const l of body.lines) {
        await tx`insert into budget_line (set_id, category_id, amount)
                 values (${id}, ${l.id}, ${l.amount})`;
      }
      if (set.current_at) await materialise(tx, actor.household_id, id);
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `${head.name} saved.` };
  });
}

/** Make one current. The months it covers are rewritten from this month on;
 *  the budget that was current keeps every figure it had. */
export async function useBudgetSet(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    if (!UUID.test(id)) return { ok: false, error: 'That budget could not be read.' };
    const [set] = await sql`
      select id, name from budget_set where id = ${id} and household_id = ${actor.household_id}`;
    if (!set) return { ok: false, error: 'That budget is not one of yours.' };

    await sql.begin(async (tx) => {
      await tx`update budget_set set current_at = null
               where household_id = ${actor.household_id} and current_at is not null`;
      await tx`update budget_set set current_at = now()
               where id = ${id} and household_id = ${actor.household_id}`;
      await materialise(tx, actor.household_id, id);
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `${set.name} is your budget now.` };
  });
}

/** Deleting one is deleting it: the lines go, and if it was current the months
 *  ahead go with it. Every earlier month stays exactly as it was. */
export async function deleteBudgetSet(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    if (!UUID.test(id)) return { ok: false, error: 'That budget could not be read.' };
    const [set] = await sql`
      select id, name, current_at from budget_set
      where id = ${id} and household_id = ${actor.household_id}`;
    if (!set) return { ok: false, error: 'That budget is not one of yours.' };
    await sql.begin(async (tx) => {
      if (set.current_at) {
        await tx`delete from budget
                 where household_id = ${actor.household_id} and month >= ${thisMonth()}::date`;
      }
      await tx`delete from budget_set where id = ${id} and household_id = ${actor.household_id}`;
    });
    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `${set.name} deleted.` };
  });
}
