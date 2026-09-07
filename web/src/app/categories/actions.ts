'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { rethrowControlFlow } from '@/lib/rethrow';
import { ICONS, TINTS } from './options';

export type Result = { ok: true; message?: string } | { ok: false; error: string };


async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change categories.');
  return actor;
}

type Shape = { name: string; icon: string; tint: string };

function shape(fd: FormData): Shape | { error: string } {
  const name = String(fd.get('name') ?? '').trim();
  const icon = String(fd.get('icon') ?? '');
  const tint = String(fd.get('tint') ?? '');
  if (name.length < 2) return { error: 'Give the category a name.' };
  if (name.length > 40) return { error: 'Names are 40 characters at most.' };
  if (!(ICONS as readonly string[]).includes(icon)) return { error: 'Pick an icon.' };
  if (!(TINTS as readonly string[]).includes(tint)) return { error: 'Pick a colour.' };
  return { name, icon, tint };
}

export async function addCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const v = shape(fd);
  if ('error' in v) return { ok: false, error: v.error };

  const [{ n }] = await sql`
    select coalesce(max(sort_order), -1) + 1 as n from category
    where household_id = ${actor.household_id}`;

  try {
    await sql`
      insert into category (household_id, name, icon, tint, sort_order)
      values (${actor.household_id}, ${v.name}, ${v.icon}, ${v.tint}, ${n})`;
  } catch {
    // The unique index is on (household, name), archived ones included.
    return { ok: false, error: 'You already have a category with that name.' };
  }

  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/add');
  return { ok: true, message: `${v.name} added.` };
}

/* Renaming is safe in a way that deleting is not: every entry points at the
   row, so they all follow the new name and no month changes value. */
export async function editCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const id = String(fd.get('id') ?? '');
  const v = shape(fd);
  if ('error' in v) return { ok: false, error: v.error };

  try {
    const done = await sql`
      update category set name = ${v.name}, icon = ${v.icon}, tint = ${v.tint}
      where id = ${id} and household_id = ${actor.household_id} returning id`;
    if (!done.length) return { ok: false, error: 'That category is not one of yours.' };
  } catch {
    return { ok: false, error: 'You already have a category with that name.' };
  }

  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/entries');
  revalidatePath('/');
  return { ok: true, message: 'Saved.' };
}

/* Retired, never deleted. Entries and budgets keep pointing at it, so no month
   changes value — a retired category simply stops being offered for new
   spending, and still appears in the months it was used. */
export async function retireCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const id = String(fd.get('id') ?? '');

  const [{ n }] = await sql`
    select count(*)::int as n from category
    where household_id = ${actor.household_id} and archived_at is null`;
  if (n <= 1) return { ok: false, error: 'That is your last category. Add another first.' };

  const done = await sql`
    update category set archived_at = now()
    where id = ${id} and household_id = ${actor.household_id} and archived_at is null
    returning name`;
  if (!done.length) return { ok: false, error: 'That category is not one of yours.' };

  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/add');
  return { ok: true, message: `${done[0].name} retired. Everything filed under it is untouched.` };
}

export async function restoreCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  const done = await sql`
    update category set archived_at = null
    where id = ${String(fd.get('id') ?? '')} and household_id = ${actor.household_id}
    returning name`;
  if (!done.length) return { ok: false, error: 'That category is not one of yours.' };
  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/add');
  return { ok: true, message: `${done[0].name} is back.` };
}

/** Order decides what Add Entry offers first, which is worth controlling when
 *  three of the eight are used daily and the rest are not. */
export async function moveCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }

  const id = String(fd.get('id') ?? '');
  const up = String(fd.get('direction') ?? '') === 'up';

  const rows = await sql`
    select id, sort_order from category
    where household_id = ${actor.household_id} and archived_at is null
    order by sort_order, name`;
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return { ok: false, error: 'That category is not one of yours.' };
  const j = up ? i - 1 : i + 1;
  if (j < 0 || j >= rows.length) return { ok: true };

  // Rewrite the whole run, so a list that has drifted into ties or gaps comes
  // back tidy instead of refusing to move.
  const order = [...rows];
  [order[i], order[j]] = [order[j], order[i]];
  await sql.begin(async (tx) => {
    for (const [k, r] of order.entries()) {
      await tx`update category set sort_order = ${k} where id = ${r.id}`;
    }
  });

  revalidatePath('/categories');
  revalidatePath('/add');
  return { ok: true };
}
