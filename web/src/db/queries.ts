import 'server-only';
import { sql } from './client';
import { auth } from '@/auth';
import { membershipOf } from './membership';
import { hashLinkToken } from '@/lib/link-token';

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
  /* Expiry is decided by the clock, not by a job that may never have run.
     There is no token here to select: only its hash is stored, so a link
     cannot be shown twice. Losing one means revoking it and sending another,
     which is the behaviour we want anyway. */
  return sql`
    select id, email, role, expires_at,
           expires_at <= now() as expired
    from invite
    where household_id = ${householdId} and status = 'open'
    order by created_at desc
  ` as Promise<{ id: string; email: string; role: 'adult' | 'viewer';
                 expires_at: Date; expired: boolean }[]>;
}

export async function householdName(householdId: string) {
  const [h] = await sql`select name from household where id = ${householdId}`;
  return (h?.name as string) ?? 'Household';
}

/** An invite looked up by its link. Only the SHA-256 of the token is stored,
 *  so this is the only way back to the row and a copy of the database yields
 *  no working links. */
export async function inviteByToken(token: string) {
  const [row] = await sql`
    select i.id, i.email, i.role, i.status, i.expires_at, i.household_id,
           i.expires_at <= now() as expired,
           h.name as household, u.name as invited_by,
           exists (select 1 from app_user a where a.email = lower(i.email)) as has_account
    from invite i
    join household h on h.id = i.household_id
    left join app_user u on u.id = i.invited_by
    where i.token_hash = ${hashLinkToken(token)}`;
  return (row ?? null) as null | {
    id: string; email: string; role: 'adult' | 'viewer'; household_id: string;
    status: 'open' | 'accepted' | 'revoked' | 'expired';
    expires_at: Date; expired: boolean; household: string;
    invited_by: string | null; has_account: boolean };
}

/** A reset link. Deliberately says nothing about who it belongs to beyond the
 *  name — a link that has gone astray should not also hand over an address. */
export async function resetByToken(token: string) {
  const [row] = await sql`
    select r.id, r.expires_at, r.used_at,
           r.expires_at <= now() as expired, u.name
    from password_reset r join app_user u on u.id = r.user_id
    where r.token_hash = ${hashLinkToken(token)}`;
  return (row ?? null) as null | {
    id: string; expires_at: Date; used_at: Date | null; expired: boolean; name: string };
}

/* ── where the money sits ───────────────────────────────────────────────── */

export type AccountRow = {
  id: string; name: string; kind: 'spending' | 'savings' | 'credit' | 'cash';
  last4: string | null; opening_balance: string; balance: string; entries: number;
  credit_limit: string | null; statement_day: number | null; due_day: number | null;
  methods: number;
};

/** Balances come from `account_balance`, never from a stored figure — a
 *  balance written down is a balance that can disagree with the entries
 *  underneath it, which is precisely what the audit of v1 found. */
export async function accountsWithBalances(householdId: string) {
  return sql`
    select b.id, b.name, b.kind, b.last4, b.opening_balance::text, b.balance::text,
           b.entries::int, b.credit_limit::text, b.statement_day, b.due_day,
           (select count(*)::int from payment_method m
            where m.funding_account_id = b.id and m.archived_at is null) as methods
    from account_balance b
    where b.household_id = ${householdId} and b.archived_at is null and b.kind <> 'person'
    order by case b.kind when 'spending' then 0 when 'cash' then 1
                         when 'savings' then 2 else 3 end, b.name
  ` as Promise<AccountRow[]>;
}

export async function openCyclesFor(householdId: string) {
  return sql`
    select c.account_id, c.period_start, c.period_end, c.due_on,
           c.charged::text, c.entries::int
    from card_open_cycle c
    join account a on a.id = c.account_id
    where a.household_id = ${householdId}
  ` as Promise<{ account_id: string; period_start: Date; period_end: Date;
                 due_on: Date; charged: string; entries: number }[]>;
}

export async function methodsWithFunding(householdId: string) {
  return sql`
    select m.id, m.name, m.kind, m.handle, m.is_default, m.sort_order,
           a.id as account_id, a.name as funds, a.kind as funds_kind,
           (select count(*)::int from txn t
            where t.payment_method_id = m.id and t.deleted_at is null) as uses
    from payment_method m
    join account a on a.id = m.funding_account_id
    where m.household_id = ${householdId} and m.archived_at is null
    order by m.sort_order, m.name
  ` as Promise<{ id: string; name: string; kind: string; handle: string | null;
                 is_default: boolean; sort_order: number; account_id: string;
                 funds: string; funds_kind: string; uses: number }[]>;
}

/** What the household has actually done yet. Drives the getting-started list,
 *  so the steps tick themselves off from real rows rather than from a flag
 *  somebody has to remember to set. */
export async function setupProgress(householdId: string) {
  const [r] = await sql`
    select
      (select count(*)::int from account
        where household_id = ${householdId} and archived_at is null and kind <> 'person') as accounts,
      (select count(*)::int from account
        where household_id = ${householdId} and archived_at is null and kind = 'credit') as cards,
      (select count(*)::int from payment_method
        where household_id = ${householdId} and archived_at is null) as methods,
      (select count(*)::int from txn
        where household_id = ${householdId} and deleted_at is null) as entries,
      (select count(*)::int from member where household_id = ${householdId}) as members`;
  return r as unknown as {
    accounts: number; cards: number; methods: number; entries: number; members: number };
}
