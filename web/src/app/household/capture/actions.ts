'use server';

import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { createCaptureToken, revokeCaptureToken } from '@/db/capture';
import { rethrowControlFlow } from '@/lib/rethrow';

/* A phone's key to forward bank messages into these books. Reachable by direct
   POST like every action, so who may do what is decided here: a viewer issues
   nothing; anyone else issues keys for their own phones and revokes their own;
   an owner may also revoke anyone's in the household. */

export type AddResult = { ok: true; token: string; label: string } | { ok: false; error: string } | null;
export type RevokeResult = { ok: true } | { ok: false; error: string } | null;

const MAX_LIVE = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A new key for one phone. The plaintext is returned to this one response and
 *  never again: only its hash is stored. */
export async function addPhone(_prev: AddResult, fd: FormData): Promise<AddResult> {
  let actor;
  try { actor = await currentActor(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: 'That could not be done. Try again.' }; }
  if (actor.role === 'viewer') return { ok: false, error: 'Viewers cannot add phones.' };
  const label = String(fd.get('label') ?? '').replace(/\s+/g, ' ').trim();
  if (!label) return { ok: false, error: 'Name the phone, so you can tell it apart later.' };
  if (label.length > 40) return { ok: false, error: 'Keep the name under 40 characters.' };

  const live = await withHousehold(actor.household_id, async () => {
    const [{ n }] = await sql`select count(*)::int as n from capture_token
                              where household_id = ${actor.household_id} and user_id = ${actor.user_id}
                                and revoked_at is null`;
    return n as number;
  });
  if (live >= MAX_LIVE) return { ok: false, error: `You have ${MAX_LIVE} phones already. Revoke one you no longer use first.` };

  const token = await createCaptureToken(actor.user_id, actor.household_id, label);
  revalidatePath('/household/capture');
  return { ok: true, token, label };
}

/** Stop a phone's key working, at once. Your own, or — for an owner — anyone's
 *  in this household. */
export async function revokePhone(_prev: RevokeResult, fd: FormData): Promise<RevokeResult> {
  let actor;
  try { actor = await currentActor(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: 'That could not be done. Try again.' }; }
  // A viewer's own key already opens nothing (capture_lookup refuses it); taking it away is still theirs to do.
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) return { ok: false, error: 'That phone could not be read.' };

  const holder = await withHousehold(actor.household_id, async () => {
    const [t] = await sql`select user_id from capture_token
                          where id = ${id} and household_id = ${actor.household_id} and revoked_at is null`;
    return (t?.user_id as string | undefined) ?? null;
  });
  if (!holder) return { ok: false, error: 'That phone is not set up here any more.' };
  if (holder !== actor.user_id && actor.role !== 'owner') {
    return { ok: false, error: 'Only an owner can revoke someone else’s phone.' };
  }
  if (!(await revokeCaptureToken(actor.household_id, id))) {
    return { ok: false, error: 'That phone is not set up here any more.' };
  }
  revalidatePath('/household/capture');
  return { ok: true };
}
