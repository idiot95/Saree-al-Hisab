'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
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

/* Budget plans: an amount per month for a category, between two months, kept
   as a thing you can come back and edit.

   Saving one MATERIALISES it — the monthly rows in `budget` are what every
   screen reads, so the plan writes them and stays the record of why they say
   what they say. Rewriting a plan clears the months it used to cover before
   writing the ones it covers now, so shortening a range takes the tail with
   it rather than leaving orphaned months nobody can see or explain. */
const MONTH_ONLY = /^\d{4}-\d{2}$/;
/* Ten years. Long enough for "until the loan is paid", short enough that a
   typo cannot write a hundred thousand rows. */
const MAX_MONTHS = 120;

export async function saveBudgetPlan(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const categoryId = String(fd.get('categoryId') ?? '');
    if (!/^[0-9a-f-]{36}$/.test(categoryId)) return { ok: false, error: 'Choose a category.' };
    const from = String(fd.get('from') ?? '');
    const to = String(fd.get('to') ?? '');
    if (!MONTH_ONLY.test(from) || !MONTH_ONLY.test(to)) return { ok: false, error: 'Give a first and a last month.' };
    if (to < from) return { ok: false, error: 'The last month comes before the first.' };

    const minor = amount(fd.get('amount'));
    if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };
    if (minor > 1_000_000_000_00) return { ok: false, error: 'That is more than the app can hold.' };

    const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
      + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
    if (months > MAX_MONTHS) return { ok: false, error: 'A plan runs for ten years at most.' };

    const [cat] = await sql`
      select id, name, scope from category
      where id = ${categoryId} and household_id = ${actor.household_id} and archived_at is null`;
    if (!cat) return { ok: false, error: 'That category is not one of yours.' };
    if (cat.scope === 'income') return { ok: false, error: `${cat.name} is for income. A budget is what you plan to spend.` };

    const starts = `${from}-01`;
    const ends = `${to}-01`;

    await sql.begin(async (tx) => {
      // Whatever this plan used to cover stops being covered by it.
      const [old] = await tx`
        select starts_on, ends_on from budget_plan
        where household_id = ${actor.household_id} and category_id = ${categoryId}`;
      if (old) {
        await tx`delete from budget
                 where household_id = ${actor.household_id} and category_id = ${categoryId}
                   and month >= ${old.starts_on} and month <= ${old.ends_on}`;
      }
      await tx`
        insert into budget_plan (household_id, category_id, amount, starts_on, ends_on)
        values (${actor.household_id}, ${categoryId}, ${minor}, ${starts}::date, ${ends}::date)
        on conflict (category_id) do update
          set amount = excluded.amount, starts_on = excluded.starts_on, ends_on = excluded.ends_on`;
      // generate_series does the calendar, so February and December are not
      // special cases somebody has to remember.
      await tx`
        insert into budget (household_id, category_id, month, amount)
        select ${actor.household_id}, ${categoryId}, m::date, ${minor}
        from generate_series(${starts}::date, ${ends}::date, interval '1 month') m
        on conflict (category_id, month) do update set amount = excluded.amount`;
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: `${cat.name} budgeted for ${months} ${months === 1 ? 'month' : 'months'}.` };
  });
}

/** Dropping a plan takes its months with it — they only ever existed because
 *  the plan said so. A month edited by hand since is overwritten either way,
 *  which is why the screen says what the plan covers. */
export async function dropBudgetPlan(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: 'That plan could not be read.' };
    const [p] = await sql`
      select category_id, starts_on, ends_on from budget_plan
      where id = ${id} and household_id = ${actor.household_id}`;
    if (!p) return { ok: false, error: 'That plan is not one of yours.' };
    await sql.begin(async (tx) => {
      await tx`delete from budget
               where household_id = ${actor.household_id} and category_id = ${p.category_id}
                 and month >= ${p.starts_on} and month <= ${p.ends_on}`;
      await tx`delete from budget_plan where id = ${id} and household_id = ${actor.household_id}`;
    });
    revalidatePath('/budget');
    revalidatePath('/');
    return { ok: true, message: 'Plan removed.' };
  });
}

/* Creating a budget from nothing: several categories, an amount each, and one
   date they all run until.

   The same materialisation a single plan uses, done for a handful at once —
   because the first budget a household sets is never one category, and making
   them repeat the form eight times is how a budget does not get set. Every
   category named gets its own plan, so each can be changed or dropped
   separately afterwards. */
export async function createBudget(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const from = String(fd.get('from') ?? '');
    const to = String(fd.get('to') ?? '');
    if (!MONTH_ONLY.test(from) || !MONTH_ONLY.test(to)) return { ok: false, error: 'Give a first and a last month.' };
    if (to < from) return { ok: false, error: 'The last month comes before the first.' };
    const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12
      + (Number(to.slice(5, 7)) - Number(from.slice(5, 7))) + 1;
    if (months > MAX_MONTHS) return { ok: false, error: 'A budget runs for ten years at most.' };

    const spendable = await sql`
      select id, name from category
      where household_id = ${actor.household_id} and archived_at is null and scope <> 'income'`;

    const wanted: { id: string; amount: number }[] = [];
    for (const c of spendable) {
      const raw = fd.get(`c_${c.id}`);
      if (raw === null || String(raw).trim() === '') continue;
      const minor = amount(raw);
      if (!Number.isSafeInteger(minor) || minor < 0) return { ok: false, error: `${c.name} is not a number.` };
      if (minor > 1_000_000_000_00) return { ok: false, error: 'That is more than the app can hold.' };
      if (minor > 0) wanted.push({ id: c.id as string, amount: minor });
    }
    if (wanted.length === 0) return { ok: false, error: 'Give at least one category an amount.' };

    const starts = `${from}-01`;
    const ends = `${to}-01`;
    await sql.begin(async (tx) => {
      for (const w of wanted) {
        const [old] = await tx`
          select starts_on, ends_on from budget_plan
          where household_id = ${actor.household_id} and category_id = ${w.id}`;
        if (old) {
          await tx`delete from budget
                   where household_id = ${actor.household_id} and category_id = ${w.id}
                     and month >= ${old.starts_on} and month <= ${old.ends_on}`;
        }
        await tx`
          insert into budget_plan (household_id, category_id, amount, starts_on, ends_on)
          values (${actor.household_id}, ${w.id}, ${w.amount}, ${starts}::date, ${ends}::date)
          on conflict (category_id) do update
            set amount = excluded.amount, starts_on = excluded.starts_on, ends_on = excluded.ends_on`;
        await tx`
          insert into budget (household_id, category_id, month, amount)
          select ${actor.household_id}, ${w.id}, m::date, ${w.amount}
          from generate_series(${starts}::date, ${ends}::date, interval '1 month') m
          on conflict (category_id, month) do update set amount = excluded.amount`;
      }
    });

    revalidatePath('/budget');
    revalidatePath('/');
    return {
      ok: true,
      message: `${wanted.length} ${wanted.length === 1 ? 'category' : 'categories'} budgeted for ${months} ${months === 1 ? 'month' : 'months'}.`,
    };
  });
}
