'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { rethrowControlFlow } from '@/lib/rethrow';
import { ICONS, TINTS } from './options';
import { isScope, type Scope } from '@/lib/scope';

export type Result = { ok: true; message?: string } | { ok: false; error: string };


async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change categories.');
  return actor;
}

type Shape = { name: string; icon: string; tint: string; scope: Scope; parentId: string | null };

function shape(fd: FormData): Shape | { error: string } {
  const name = String(fd.get('name') ?? '').trim();
  const icon = String(fd.get('icon') ?? '');
  const tint = String(fd.get('tint') ?? '');
  const parentId = String(fd.get('parentId') ?? '').trim() || null;
  // A child's form sends no scope: it takes its parent's, in the trigger too.
  const scope = parentId ? 'expense' : fd.get('scope') ?? 'expense';
  if (name.length < 2) return { error: 'Give the category a name.' };
  if (name.length > 40) return { error: 'Names are 40 characters at most.' };
  if (!(ICONS as readonly string[]).includes(icon)) return { error: 'Pick an icon.' };
  if (!(TINTS as readonly string[]).includes(tint)) return { error: 'Pick a colour.' };
  if (!isScope(scope)) return { error: 'Say whether it is for spending, income, or both.' };
  if (parentId && !/^[0-9a-f-]{36}$/.test(parentId)) return { error: 'That parent could not be read.' };
  return { name, icon, tint, scope, parentId };
}

/* A scope may narrow only where nothing filed under the category (or the
   ones under it) contradicts the narrower reading — the trigger in 0108
   refuses otherwise. Checked here too, so the household gets a sentence
   naming what is in the way rather than a constraint's message. */
async function checkScope(householdId: string, id: string, scope: Scope): Promise<string | null> {
  if (scope === 'both') return null;
  const [n] = await sql`
    select
      (select count(*)::int from txn t
        where t.household_id = ${householdId} and t.kind <> 'income'
          and t.category_id in (select id from category where id = ${id} or parent_id = ${id}))
      + (select count(*)::int from schedule s
        where s.household_id = ${householdId} and s.kind <> 'income'
          and s.category_id in (select id from category where id = ${id} or parent_id = ${id}))
      + (select count(*)::int from budget b
        where b.household_id = ${householdId} and b.category_id = ${id}) as spending,
      (select count(*)::int from txn t
        where t.household_id = ${householdId} and t.kind = 'income'
          and t.category_id in (select id from category where id = ${id} or parent_id = ${id}))
      + (select count(*)::int from schedule s
        where s.household_id = ${householdId} and s.kind = 'income'
          and s.category_id in (select id from category where id = ${id} or parent_id = ${id})) as income`;
  if (scope === 'income' && n.spending > 0) {
    return 'Spending is filed under it, so it cannot be for income only. Choose Both.';
  }
  if (scope === 'expense' && n.income > 0) {
    return 'Income is filed under it, so it cannot be for spending only. Choose Both.';
  }
  return null;
}

/* A parent must be one of ours, live, and standing on its own — one level,
   as the trigger in 0108 also insists. Checked here too so the household
   gets a sentence rather than a constraint name. */
async function checkParent(householdId: string, parentId: string | null, self?: string) {
  if (!parentId) return null;
  if (parentId === self) return 'A category cannot sit under itself.';
  const [p] = await sql`
    select name, parent_id, archived_at from category
    where id = ${parentId} and household_id = ${householdId}`;
  if (!p) return 'That parent is not one of your categories.';
  if (p.archived_at) return `${p.name} is retired. Bring it back first.`;
  if (p.parent_id) return `${p.name} already sits under another category; one level only.`;
  return null;
}

export async function addCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const v = shape(fd);
    if ('error' in v) return { ok: false, error: v.error };
    const bad = await checkParent(actor.household_id, v.parentId);
    if (bad) return { ok: false, error: bad };

    // Order runs among siblings: the top level has its own run, and each
    // parent's children have theirs.
    const [{ n }] = await sql`
      select coalesce(max(sort_order), -1) + 1 as n from category
      where household_id = ${actor.household_id}
        and parent_id is not distinct from ${v.parentId}::uuid`;

    try {
      await sql`
        insert into category (household_id, name, icon, tint, scope, sort_order, parent_id)
        values (${actor.household_id}, ${v.name}, ${v.icon}, ${v.tint}, ${v.scope}, ${n}, ${v.parentId}::uuid)`;
    } catch {
      // The unique index is on (household, name), archived ones included.
      return { ok: false, error: 'You already have a category with that name.' };
    }

    revalidatePath('/categories');
    revalidatePath('/budget');
    revalidatePath('/add');
    return { ok: true, message: `${v.name} added.` };
  });
}

/* Renaming is safe in a way that deleting is not: every entry points at the
   row, so they all follow the new name and no month changes value. Moving a
   category under a parent is the same kind of safe: its entries stay its
   own, and from now on they also count towards the parent's line. */
export async function editCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('id') ?? '');
    const v = shape(fd);
    if ('error' in v) return { ok: false, error: v.error };

    const [cur] = await sql`
      select c.parent_id, (select count(*) from category k where k.parent_id = c.id) as kids
      from category c where c.id = ${id} and c.household_id = ${actor.household_id}`;
    if (!cur) return { ok: false, error: 'That category is not one of yours.' };
    if (v.parentId && Number(cur.kids) > 0) {
      return { ok: false, error: 'This one has categories under it, so it cannot move under another.' };
    }
    const bad = await checkParent(actor.household_id, v.parentId, id);
    if (bad) return { ok: false, error: bad };
    if (!v.parentId) {
      const stuck = await checkScope(actor.household_id, id, v.scope);
      if (stuck) return { ok: false, error: stuck };
    }

    try {
      const done = await sql`
        update category set name = ${v.name}, icon = ${v.icon}, tint = ${v.tint},
          parent_id = ${v.parentId}::uuid,
          -- a child takes its parent's scope (the trigger sets it either way)
          scope = ${v.scope},
          -- a category that changes family joins the end of its new run
          sort_order = case when parent_id is not distinct from ${v.parentId}::uuid then sort_order
            else (select coalesce(max(sort_order), -1) + 1 from category s
                  where s.household_id = ${actor.household_id}
                    and s.parent_id is not distinct from ${v.parentId}::uuid) end
        where id = ${id} and household_id = ${actor.household_id} returning id`;
      if (!done.length) return { ok: false, error: 'That category is not one of yours.' };
    } catch {
      return { ok: false, error: 'You already have a category with that name.' };
    }

    revalidatePath('/categories');
    revalidatePath('/budget');
    revalidatePath('/entries');
    revalidatePath('/add');
    revalidatePath('/');
    return { ok: true, message: 'Saved.' };
  });
}

/* Retired, never deleted. Entries and budgets keep pointing at it, so no month
   changes value — a retired category simply stops being offered for new
   spending, and still appears in the months it was used. Retiring a parent
   retires the children with it; they come back with it too. */
export async function retireCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');

    const [{ n }] = await sql`
      select count(*)::int as n from category
      where household_id = ${actor.household_id} and archived_at is null
        and id <> ${id} and parent_id is distinct from ${id}::uuid`;
    if (n < 1) return { ok: false, error: 'That is your last category. Add another first.' };

    const done = await sql`
      update category set archived_at = now()
      where household_id = ${actor.household_id} and archived_at is null
        and (id = ${id} or parent_id = ${id}::uuid)
      returning name, (parent_id is null) as top`;
    if (!done.length) return { ok: false, error: 'That category is not one of yours.' };
    const own = done.find((r) => r.top) ?? done[0];
    const kids = done.length - 1;
    const withKids = kids > 0 ? ` with the ${kids === 1 ? 'one' : kids} under it` : '';
    return finish(`${own.name} retired${withKids}. Everything filed there is untouched.`);
  });
}

function finish(message: string): Result {
  revalidatePath('/categories');
  revalidatePath('/budget');
  revalidatePath('/add');
  return { ok: true, message };
}

export async function restoreCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    // A child cannot stand under a retired parent, so the parent comes back
    // with it. And a parent that was retired with its children brings back
    // the ones that went at the same moment — one UPDATE stamps one now(), so
    // the timestamp is the family's ticket — while a child retired on its own
    // earlier stays retired.
    const done = await sql`
      with me as (
        select id, parent_id, archived_at from category
        where id = ${id} and household_id = ${actor.household_id})
      update category c set archived_at = null
      from me where c.household_id = ${actor.household_id}
        and (c.id = me.id or c.id = me.parent_id
             or (c.parent_id = me.id and c.archived_at = me.archived_at))
      returning c.name, (c.id = me.id) as self, (c.parent_id = me.id) as kid`;
    if (!done.length) return { ok: false, error: 'That category is not one of yours.' };
    const self = done.find((r) => r.self)?.name;
    const parent = done.find((r) => !r.self && !r.kid)?.name;
    const kids = done.filter((r) => r.kid).length;
    if (parent) return finish(`${self} is back, under ${parent}.`);
    if (kids) return finish(`${self} is back, with the ${kids === 1 ? 'one' : kids} under it.`);
    return finish(`${self} is back.`);
  });
}

/** Order decides what Add Entry offers first, which is worth controlling when
 *  three of the eight are used daily and the rest are not. A move stays in
 *  its run — among the top level, or among one parent's children. */
export async function moveCategory(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('id') ?? '');
    const up = String(fd.get('direction') ?? '') === 'up';

    const rows = await sql`
      select id, sort_order from category
      where household_id = ${actor.household_id} and archived_at is null
        and parent_id is not distinct from (
          select parent_id from category where id = ${id} and household_id = ${actor.household_id})
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
  });
}

/** The whole order at once, from a drag. The client sends the ids it thinks
 *  are in use, in the order it wants; the server insists that this is
 *  EXACTLY the household's live top-level set — nothing missing, nothing
 *  extra, nothing belonging to anyone else — before writing a single row.
 *  Children move with their parent and keep their own order. A list that
 *  has changed under the drag (someone retired one meanwhile) is refused
 *  whole, and the screen simply refreshes to what is true. */
export async function reorderCategories(ids: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200
        || !ids.every((x) => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x))
        || new Set(ids).size !== ids.length) {
      return { ok: false, error: 'That order could not be read.' };
    }

    const rows = await sql`
      select id from category
      where household_id = ${actor.household_id} and archived_at is null and parent_id is null`;
    const mine = new Set(rows.map((r) => r.id as string));
    if (mine.size !== ids.length || !ids.every((id) => mine.has(id))) {
      revalidatePath('/categories');
      return { ok: false, error: 'The list changed. Try again.' };
    }

    await sql.begin(async (tx) => {
      for (const [k, id] of (ids as string[]).entries()) {
        await tx`update category set sort_order = ${k}
                 where id = ${id} and household_id = ${actor.household_id}`;
      }
    });

    revalidatePath('/categories');
    revalidatePath('/add');
    return { ok: true };
  });
}
