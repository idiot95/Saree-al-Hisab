'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';

/* Every one of these is reachable by direct POST, so each re-establishes who
   is asking and what they are allowed to do. Hiding a button is presentation;
   this is the actual rule. */

const INVITE_DAYS = 7;

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function mustManage() {
  const actor = await currentActor();
  if (actor.role !== 'owner') {
    throw new Error('Only the owner can change who is in this household.');
  }
  return actor;
}

export async function createInvite(formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const role = String(formData.get('role') ?? '');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }
  // Ownership is not handed out through a link. It is transferred deliberately,
  // by an owner, to someone already in the household.
  if (role !== 'adult' && role !== 'viewer') {
    return { ok: false, error: 'Choose whether they can add entries or only view.' };
  }

  const [already] = await sql`
    select 1 from member m join app_user u on u.id = m.user_id
    where m.household_id = ${actor.household_id} and lower(u.email) = ${email}`;
  if (already) return { ok: false, error: 'They are already in this household.' };

  // Supersede any earlier open invite to the same person rather than leaving
  // two live links to the same books.
  await sql`update invite set status = 'revoked'
            where household_id = ${actor.household_id}
              and lower(email) = ${email} and status = 'open'`;

  const token = randomBytes(32).toString('base64url');
  await sql`insert into invite ${sql({
    household_id: actor.household_id,
    email,
    role,
    token,
    invited_by: actor.user_id,
    expires_at: new Date(Date.now() + INVITE_DAYS * 864e5),
  })}`;

  revalidatePath('/household');
  return { ok: true, message: token };
}

export async function revokeInvite(formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const id = String(formData.get('id') ?? '');
  await sql`update invite set status = 'revoked'
            where id = ${id} and household_id = ${actor.household_id} and status = 'open'`;
  revalidatePath('/household');
  return { ok: true };
}

export async function changeRole(formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!['owner', 'adult', 'viewer'].includes(role)) return { ok: false, error: 'Unknown role.' };

  if (userId === actor.user_id && role !== 'owner') {
    // Otherwise the last owner demotes themselves and nobody can ever invite
    // or remove anyone again.
    const [{ count }] = await sql`
      select count(*)::int from member
      where household_id = ${actor.household_id} and role = 'owner'`;
    if (count <= 1) {
      return { ok: false, error: 'Make someone else an owner first — a household needs one.' };
    }
  }

  await sql`update member set role = ${role}
            where household_id = ${actor.household_id} and user_id = ${userId}`;
  revalidatePath('/household');
  return { ok: true };
}

export async function removeMember(formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const userId = String(formData.get('userId') ?? '');
  if (userId === actor.user_id) {
    return { ok: false, error: 'You cannot remove yourself. Hand ownership over first.' };
  }
  // Their entries stay. The ledger is the household's, not the person's —
  // removing someone must never silently change what the month cost.
  await sql`delete from member
            where household_id = ${actor.household_id} and user_id = ${userId}`;
  revalidatePath('/household');
  return { ok: true };
}
