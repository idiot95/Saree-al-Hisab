import 'server-only';
import { sql } from './client';
import { hashLinkToken } from '@/lib/link-token';

export type Role = 'owner' | 'adult' | 'viewer';
export type Membership = { household_id: string; role: Role };

/* Where someone stands in a household is read from the database on every
   request, never carried in the session token. A JWT lives for weeks; being
   removed from a household, or dropped to viewer, has to take effect on the
   next tap — not at the next sign-in. The token therefore says only WHO the
   person is, and this module answers WHAT they may do. */

export async function membershipOf(userId: string): Promise<Membership | null> {
  const [m] = await sql`
    select household_id, role from member where user_id = ${userId} limit 1`;
  return (m as Membership | undefined) ?? null;
}

/* ── signing in ─────────────────────────────────────────────────────────── */

export type LoginUser = {
  id: string; email: string; name: string;
  password_hash: string | null; failed_attempts: number; locked_until: Date | null;
};

export async function findLoginUser(email: string): Promise<LoginUser | null> {
  const [u] = await sql`
    select id, email, name, password_hash, failed_attempts, locked_until
    from app_user where email = ${email.trim().toLowerCase()}`;
  return (u as LoginUser | undefined) ?? null;
}

/* Guessing has to get slower, and the slowing has to survive the process —
   a serverless function is torn down every few requests, so an in-memory
   counter would reset for free. Five wrong tries buys a minute, and each one
   after that doubles it up to half an hour.

   This does let someone lock a member out on purpose by guessing at them. In a
   household that is a nuisance rather than an attack, and half an hour is the
   most it can ever be — which is why the wait is capped rather than a lock
   that needs an owner to clear. */
const FREE_TRIES = 5, MAX_WAIT_MIN = 30;

export async function recordFailedAttempt(userId: string) {
  await sql`
    update app_user
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= ${FREE_TRIES}
          then now() + least(
            power(2, failed_attempts + 1 - ${FREE_TRIES}) * interval '1 minute',
            interval '${sql.unsafe(String(MAX_WAIT_MIN))} minutes')
          else locked_until end
    where id = ${userId}`;
}

export async function recordSuccessfulLogin(userId: string, rehashed?: string | null) {
  await sql`
    update app_user
    set failed_attempts = 0, locked_until = null, last_seen_at = now(),
        password_hash = coalesce(${rehashed ?? null}, password_hash)
    where id = ${userId}`;
}

export const isLocked = (u: { locked_until: Date | null }) =>
  !!u.locked_until && new Date(u.locked_until) > new Date();

/* Timestamps are written with the database's own clock, not this process's.
   Two reasons, and both matter: expiry is compared against now() in Postgres,
   so it should be set by the same clock it will be judged by; and a Date
   handed to the driver through a bundled build is not always recognised as
   one, which silently turns into a serialisation error at the worst moment. */

/* ── getting an account in the first place ──────────────────────────────── */

/** A household nobody is a member of, that has actually been set up. An empty
 *  shell left behind by a migration is not somewhere to put the first person:
 *  they would land in an app with no accounts and no way back out. */
export async function unclaimedHousehold(): Promise<{ id: string; name: string } | null> {
  const [h] = await sql`
    select h.id, h.name from household h
    left join member m on m.household_id = h.id
    where m.household_id is null
      and exists (select 1 from account a where a.household_id = h.id)
    order by h.created_at limit 1`;
  return (h as { id: string; name: string } | undefined) ?? null;
}

export async function emailIsTaken(email: string) {
  const [u] = await sql`select 1 from app_user where email = ${email.trim().toLowerCase()}`;
  return !!u;
}

/** The first person through the door owns the books. After that there is
 *  nothing left to claim and this returns null, so the screen disappears. */
export async function createOwner(email: string, name: string, passwordHash: string) {
  return sql.begin(async (tx) => {
    const [h] = await tx`
      select h.id from household h
      left join member m on m.household_id = h.id
      where m.household_id is null
        and exists (select 1 from account a where a.household_id = h.id)
      order by h.created_at limit 1
      for update of h skip locked`;
    if (!h) return null;
    const [u] = await tx`
      insert into app_user (email, name, password_hash, password_set_at)
      values (${email.trim().toLowerCase()}, ${name.trim()}, ${passwordHash}, now())
      returning id`;
    await tx`insert into member ${tx({ household_id: h.id, user_id: u.id, role: 'owner' })}`;
    return { userId: u.id as string, householdId: h.id as string };
  });
}

/** Create the account the invitation was addressed to, and spend the
 *  invitation doing it — both, or neither. */
export async function createFromInvite(token: string, name: string, passwordHash: string) {
  return sql.begin(async (tx) => {
    const [inv] = await tx`
      select id, household_id, email, role from invite
      where token_hash = ${hashLinkToken(token)}
        and status = 'open' and expires_at > now()
      for update`;
    if (!inv) return null;
    const [u] = await tx`
      insert into app_user (email, name, password_hash, password_set_at)
      values (${String(inv.email).toLowerCase()}, ${name.trim()}, ${passwordHash}, now())
      returning id`;
    await tx`insert into member ${tx({
      household_id: inv.household_id, user_id: u.id, role: inv.role,
    })}`;
    await tx`update invite set status = 'accepted', accepted_at = now() where id = ${inv.id}`;
    return { userId: u.id as string, email: String(inv.email).toLowerCase() };
  });
}

/** For someone who already has an account and is holding an invitation. */
export async function acceptInviteAs(token: string, userId: string, email: string) {
  return sql.begin(async (tx) => {
    const [inv] = await tx`
      select id, household_id, role from invite
      where token_hash = ${hashLinkToken(token)}
        and lower(email) = ${email.toLowerCase()}
        and status = 'open' and expires_at > now()
      for update`;
    if (!inv) return null;
    await tx`insert into member ${tx({
      household_id: inv.household_id, user_id: userId, role: inv.role,
    })} on conflict do nothing`;
    await tx`update invite set status = 'accepted', accepted_at = now() where id = ${inv.id}`;
    return { household_id: inv.household_id as string, role: inv.role as Role };
  });
}

/* ── forgotten passwords ────────────────────────────────────────────────── */

/** Spend the reset link and set the new password, or do neither. Every other
 *  live reset for that person dies at the same time. */
export async function usePasswordReset(token: string, passwordHash: string) {
  return sql.begin(async (tx) => {
    const [r] = await tx`
      select id, user_id from password_reset
      where token_hash = ${hashLinkToken(token)}
        and used_at is null and expires_at > now()
      for update`;
    if (!r) return null;
    await tx`update password_reset set used_at = now() where id = ${r.id}`;
    await tx`update password_reset set used_at = now()
             where user_id = ${r.user_id} and used_at is null`;
    await tx`update app_user
             set password_hash = ${passwordHash}, password_set_at = now(),
                 failed_attempts = 0, locked_until = null
             where id = ${r.user_id}`;
    const [u] = await tx`select email from app_user where id = ${r.user_id}`;
    return { userId: r.user_id as string, email: u.email as string };
  });
}
