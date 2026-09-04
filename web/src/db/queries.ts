import 'server-only';
import { sql } from './client';
import { auth } from '@/auth';
import { membershipOf } from './membership';

/* Who is asking, and what they may do — resolved on the server, on every
   request. A Server Action is reachable by direct POST, so the household a
   write lands in is decided here and nowhere else. The session says only who
   the person is; the role comes from the database, so a demotion or a removal
   bites on the next tap rather than at the next sign-in. */
export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in.');
  const m = await membershipOf(session.user.id);
  if (!m) throw new Error('No household yet.');
  return {
    household_id: m.household_id,
    user_id: session.user.id,
    role: m.role,
    user_name: session.user.name ?? '',
  };
}

/** For pages that need to tell the three states apart: signed out, signed in
 *  without a household, and signed in with one. */
export async function actorOrNull() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const m = await membershipOf(session.user.id);
  return {
    household_id: m?.household_id ?? null,
    user_id: session.user.id,
    role: m?.role ?? null,
    user_name: session.user.name ?? '',
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };
}

export async function categoriesFor(householdId: string) {
  return sql`
    select id, name, icon, tint from category
    where household_id = ${householdId} and archived_at is null
    order by sort_order` as Promise<{ id: string; name: string; icon: string; tint: string }[]>;
}

export async function methodsFor(householdId: string) {
  return sql`
    select m.id, m.name, m.kind, m.handle, a.name as funds, a.kind as funds_kind
    from payment_method m
    join account a on a.id = m.funding_account_id
    where m.household_id = ${householdId} and m.archived_at is null
    order by m.sort_order` as Promise<
      { id: string; name: string; kind: string; handle: string | null; funds: string; funds_kind: string }[]>;
}

export async function accountsFor(householdId: string) {
  // Person accounts are how the ledger models who owes you. They must never
  // appear in a picker, which is what the real_account view is for.
  return sql`
    select id, name, kind from real_account
    where household_id = ${householdId} and archived_at is null
    order by kind, name` as Promise<{ id: string; name: string; kind: string }[]>;
}

/* Prevention beats detection. Before Save, show what a household member has
   already recorded that this could be a second copy of — the same ±1% and
   ±2 day window the duplicate view uses, so the warning and the later Inbox
   card agree with each other. */
export async function possibleDuplicate(
  householdId: string, amountMinor: number, on: string,
) {
  const [row] = await sql`
    select t.amount::bigint, t.merchant, t.occurred_on, u.name as who, a.name as account
    from txn t
    join app_user u on u.id = t.created_by
    join account a on a.id = t.account_id
    where t.household_id = ${householdId}
      and t.deleted_at is null
      and t.kind = 'expense'
      and abs(t.amount - ${amountMinor}) <= greatest(100, ${amountMinor} / 100)
      and t.occurred_on between ${on}::date - 2 and ${on}::date + 2
    order by t.created_at desc limit 1`;
  return (row ?? null) as null | {
    amount: string; merchant: string | null; occurred_on: Date; who: string; account: string };
}

export async function membersOf(householdId: string) {
  return sql`
    select u.id, u.name, u.email, u.image, m.role, m.joined_at, u.last_seen_at
    from member m join app_user u on u.id = m.user_id
    where m.household_id = ${householdId}
    order by case m.role when 'owner' then 0 when 'adult' then 1 else 2 end, m.joined_at
  ` as Promise<{ id: string; name: string; email: string | null; image: string | null;
                 role: 'owner' | 'adult' | 'viewer'; joined_at: Date; last_seen_at: Date | null }[]>;
}

export async function openInvitesOf(householdId: string) {
  // Expiry is decided by the clock, not by a job that may never have run.
  return sql`
    select id, email, role, token, expires_at,
           expires_at <= now() as expired
    from invite
    where household_id = ${householdId} and status = 'open'
    order by created_at desc
  ` as Promise<{ id: string; email: string; role: 'adult' | 'viewer';
                 token: string; expires_at: Date; expired: boolean }[]>;
}

export async function householdName(householdId: string) {
  const [h] = await sql`select name from household where id = ${householdId}`;
  return (h?.name as string) ?? 'Household';
}

/** An invite looked up by its link. The token is only a way of SHOWING someone
 *  what they have been invited to — it is never what admits them. Acceptance
 *  happens in `resolveActor`, and matches on the email address, so a link that
 *  is forwarded, screenshotted or sitting in a chat backup opens this page for
 *  a stranger and gets them no further. */
export async function inviteByToken(token: string) {
  const [row] = await sql`
    select i.id, i.email, i.role, i.status, i.expires_at,
           i.expires_at <= now() as expired,
           h.name as household, u.name as invited_by
    from invite i
    join household h on h.id = i.household_id
    left join app_user u on u.id = i.invited_by
    where i.token = ${token}`;
  return (row ?? null) as null | {
    id: string; email: string; role: 'adult' | 'viewer';
    status: 'open' | 'accepted' | 'revoked' | 'expired';
    expires_at: Date; expired: boolean; household: string; invited_by: string | null };
}
