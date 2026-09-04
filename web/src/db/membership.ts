import 'server-only';
import { sql } from './client';
import { hashLinkToken } from '@/lib/link-token';
import { starterKitFor } from './starter';

export type Role = 'owner' | 'adult' | 'viewer';
export type Membership = { household_id: string; role: Role };

/* Where someone stands in a household is read from the database on every
   request, never carried in the session token. A JWT lives for weeks; being
   removed from a household, or dropped to viewer, has to take effect on the
   next tap — not at the next sign-in. The token therefore says only WHO the
   person is, and this module answers WHAT they may do. */

/* A person can keep their own books and be in somebody else's. Which set is on
   screen is a preference on app_user; membership is still what grants access,
   so a stale or forged preference gets you nothing — the join below only ever
   returns a household you are genuinely a member of. */
export async function membershipOf(userId: string): Promise<Membership | null> {
  const [m] = await sql`
    select m.household_id, m.role
    from member m
    join app_user u on u.id = m.user_id
    where m.user_id = ${userId}
    order by (m.household_id = u.active_household_id) desc, m.joined_at
    limit 1`;
  return (m as Membership | undefined) ?? null;
}

export async function householdsOf(userId: string) {
  return sql`
    select h.id, h.name, m.role,
           (h.id = u.active_household_id) as active,
           (select count(*)::int from member x where x.household_id = h.id) as people
    from member m
    join household h on h.id = m.household_id
    join app_user u on u.id = m.user_id
    where m.user_id = ${userId}
    order by m.joined_at
  ` as Promise<{ id: string; name: string; role: Role; active: boolean; people: number }[]>;
}

/** Switching is only ever allowed to books you are already in. */
export async function switchHousehold(userId: string, householdId: string) {
  const [m] = await sql`
    select 1 from member where user_id = ${userId} and household_id = ${householdId}`;
  if (!m) return false;
  await sql`update app_user set active_household_id = ${householdId} where id = ${userId}`;
  return true;
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

/** Books of your own, opened with enough in them to record something today. */
export async function createHousehold(userId: string, name: string) {
  return sql.begin(async (tx) => {
    const [h] = await tx`
      insert into household (name) values (${name.trim()}) returning id`;
    await tx`insert into member (household_id, user_id, role)
             values (${h.id}, ${userId}, 'owner')`;
    await tx`update app_user set active_household_id = ${h.id} where id = ${userId}`;
    await starterKitFor(tx, h.id);
    return { householdId: h.id as string };
  });
}

export async function emailIsTaken(email: string) {
  const [u] = await sql`select 1 from app_user where email = ${email.trim().toLowerCase()}`;
  return !!u;
}

/** An account and the books that come with it, in one go — or neither.
 *  Anybody may do this. Signing up gets you your OWN household and nobody
 *  else's; joining someone's books still takes an invitation from them. */
export async function signUp(
  email: string, name: string, passwordHash: string, householdName: string,
) {
  return sql.begin(async (tx) => {
    const [u] = await tx`
      insert into app_user (email, name, password_hash, password_set_at)
      values (${email.trim().toLowerCase()}, ${name.trim()}, ${passwordHash}, now())
      returning id`;
    const [h] = await tx`
      insert into household (name) values (${householdName.trim()}) returning id`;
    await tx`insert into member (household_id, user_id, role)
             values (${h.id}, ${u.id}, 'owner')`;
    await tx`update app_user set active_household_id = ${h.id} where id = ${u.id}`;
    await starterKitFor(tx, h.id);
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
      insert into app_user (email, name, password_hash, password_set_at, active_household_id)
      values (${String(inv.email).toLowerCase()}, ${name.trim()}, ${passwordHash}, now(),
              ${inv.household_id})
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
    // Land them in the books they were just invited to, not whichever set they
    // happened to be looking at.
    await tx`update app_user set active_household_id = ${inv.household_id} where id = ${userId}`;
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
