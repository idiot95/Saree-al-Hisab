'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
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

  const month = String(fd.get('month') ?? '');
  if (!MONTH.test(month)) return { ok: false, error: 'That is not a month.' };

  const categories = await sql`
    select id from category
    where household_id = ${actor.household_id} and archived_at is null`;

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
}

/** Start this month as a copy of the last one that had a budget. Existing
 *  rows for this month are left alone, so it can never overwrite work. */
export async function copyPreviousMonth(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

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
}
