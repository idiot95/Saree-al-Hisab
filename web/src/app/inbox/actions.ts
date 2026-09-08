'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change entries.');
  return actor;
}

/* Both ids are re-checked against the household. The pair comes from a view, so
   the client could otherwise name any two rows it liked. */
async function ownsBoth(householdId: string, a: string, b: string) {
  const rows = await sql`
    select id from txn
    where id in (${a}, ${b}) and household_id = ${householdId} and deleted_at is null`;
  return rows.length === 2;
}

/** "These are both real." Recorded so the pair stops being offered — the
 *  alternative is a queue that nags forever and stops being read. */
export async function notDuplicate(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const low = String(fd.get('lowId') ?? '');
    const high = String(fd.get('highId') ?? '');
    if (!(await ownsBoth(actor.household_id, low, high))) {
      return { ok: false, error: 'Those entries are not both yours.' };
    }
    // The table insists low < high, which is what stops the same pair being
    // dismissed twice under two orderings.
    const [a, b] = low < high ? [low, high] : [high, low];
    await sql`
      insert into duplicate_dismissed (low_id, high_id, dismissed_by)
      values (${a}, ${b}, ${actor.user_id}) on conflict do nothing`;

    revalidatePath('/inbox');
    return { ok: true, message: 'Kept both.' };
  });
}

/** Delete one side of the pair. Soft, like every other delete — the figures
 *  move at once and the row stays on record. */
export async function dropDuplicate(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('txnId') ?? '');
    const done = await sql`
      update txn set deleted_at = now()
      where id = ${id} and household_id = ${actor.household_id} and deleted_at is null
      returning id`;
    if (!done.length) return { ok: false, error: 'That entry is not one of yours.' };

    revalidatePath('/inbox');
    revalidatePath('/entries');
    revalidatePath('/');
    return { ok: true, message: 'Removed the copy.' };
  });
}
