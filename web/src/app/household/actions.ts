'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor } from '@/db/queries';
import { newLinkToken } from '@/lib/link-token';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/password';

/* Every one of these is reachable by direct POST, so each re-establishes who
   is asking and what they are allowed to do. Hiding a button is presentation;
   this is the actual rule. */

const INVITE_DAYS = 7;

export type Result = { ok: true; message?: string } | { ok: false; error: string };

/* Every one takes (previous state, form data) so it can be handed straight to
   useActionState. That is not a formality: an action passed through a client
   closure loses its no-JS fallback, and the form then does nothing at all
   until the bundle has downloaded and hydrated — which on a slow phone is a
   real window of taps that vanish. */

async function mustManage() {
  const actor = await currentActor();
  if (actor.role !== 'owner') {
    throw new Error('Only the owner can change who is in this household.');
  }
  return actor;
}

export async function createInvite(_prev: Result | null, formData: FormData): Promise<Result> {
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

  // Only the hash is kept. The plaintext exists in this response and in
  // whatever the owner pastes it into — nowhere else, and never again.
  const { token, hash } = newLinkToken();
  // now() rather than a Date from here: expiry is judged by the database's
  // clock, so it should be set by it too.
  await sql`
    insert into invite (household_id, email, role, token_hash, invited_by, expires_at)
    values (${actor.household_id}, ${email}, ${role}, ${hash}, ${actor.user_id},
            now() + ${INVITE_DAYS} * interval '1 day')`;

  revalidatePath('/household');
  return { ok: true, message: token };
}

export async function revokeInvite(_prev: Result | null, formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const id = String(formData.get('id') ?? '');
  await sql`update invite set status = 'revoked'
            where id = ${id} and household_id = ${actor.household_id} and status = 'open'`;
  revalidatePath('/household');
  return { ok: true };
}

export async function changeRole(_prev: Result | null, formData: FormData): Promise<Result> {
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

export async function removeMember(_prev: Result | null, formData: FormData): Promise<Result> {
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

/* ── passwords ──────────────────────────────────────────────────────────── */

const RESET_HOURS = 24;

/** Nobody here can send email, so a forgotten password is recovered the way
 *  anything else in a household is: you ask, and the owner hands you a link.
 *
 *  Which does mean an owner can take over any account in the household. That
 *  is already true of someone who can change your role and remove you, and
 *  pretending otherwise would only have added a mail provider to the bill. */
export async function issueReset(_prev: Result | null, formData: FormData): Promise<Result> {
  let actor;
  try { actor = await mustManage(); } catch (e) { return { ok: false, error: (e as Error).message }; }
  const userId = String(formData.get('userId') ?? '');

  const [member] = await sql`
    select u.id from member m join app_user u on u.id = m.user_id
    where m.household_id = ${actor.household_id} and u.id = ${userId}`;
  if (!member) return { ok: false, error: 'They are not in this household.' };

  // One live link at a time, so an old one cannot be dug out of a chat later.
  await sql`update password_reset set used_at = now()
            where user_id = ${userId} and used_at is null`;

  const { token, hash } = newLinkToken();
  await sql`
    insert into password_reset (user_id, token_hash, issued_by, expires_at)
    values (${userId}, ${hash}, ${actor.user_id}, now() + ${RESET_HOURS} * interval '1 hour')`;

  revalidatePath('/household');
  return { ok: true, message: token };
}

/** Changing your own password needs the old one, which is what stops a
 *  borrowed unlocked phone from becoming a permanent takeover. */
export async function changeMyPassword(_prev: Result | null, formData: FormData): Promise<Result> {
  const actor = await currentActor();
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');

  const [me] = await sql`select email, password_hash from app_user where id = ${actor.user_id}`;
  if (!me?.password_hash || !(await verifyPassword(current, me.password_hash))) {
    return { ok: false, error: 'That is not your current password.' };
  }
  const weak = passwordProblem(next, me.email);
  if (weak) return { ok: false, error: weak };
  if (String(formData.get('confirm') ?? '') !== next) {
    return { ok: false, error: 'The two new passwords are not the same.' };
  }

  await sql`update app_user
            set password_hash = ${await hashPassword(next)}, password_set_at = now(),
                failed_attempts = 0, locked_until = null
            where id = ${actor.user_id}`;
  // Any reset link an owner issued is now moot.
  await sql`update password_reset set used_at = now()
            where user_id = ${actor.user_id} and used_at is null`;
  return { ok: true, message: 'Changed. It takes effect next time you sign in.' };
}
