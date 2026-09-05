import 'server-only';
import { redirect } from 'next/navigation';
import { sql } from './client';
import { auth } from '@/auth';
import { contextFor } from './membership';
import { hashLinkToken } from '@/lib/link-token';

/* Who is asking, and what they may do — resolved on the server, on every
   request, in a single round trip.

   Three things are checked here and nowhere else:
     · the session cookie is real (Auth.js has already verified its signature);
     · it was issued AFTER the account's session epoch, so a cookie that walked
       out of the door before a password change is refused;
     · the role comes from the database, so a demotion or a removal bites on
       the next tap rather than at the next sign-in.

   A Server Action is reachable by direct POST, so the household a write lands
   in is decided here and nowhere else. */
export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  const c = await contextFor(session.user.id, session.issuedAt ?? 0);
  // A cookie older than the account's session epoch is not an error to report,
  // it is somebody who has been signed out. Send them to sign in again.
  if (!c || c.stale) redirect('/signin');
  if (!c.household_id) redirect('/no-household');
  return {
    household_id: c.household_id,
    user_id: session.user.id,
    role: c.role!,
    user_name: session.user.name ?? '',
    household_name: c.household_name ?? 'Household',
  };
}

/** For pages that need to tell the three states apart: signed out, signed in
 *  without a household, and signed in with one. A stale cookie counts as
 *  signed out. */
export async function actorOrNull() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const c = await contextFor(session.user.id, session.issuedAt ?? 0);
  if (!c || c.stale) return null;
  return {
    household_id: c.household_id,
    user_id: session.user.id,
    role: c.role,
    user_name: session.user.name ?? '',
    household_name: c.household_name ?? 'Household',
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

/* ── the budget, which everything reports against ───────────────────────── */

export type BudgetRow = {
  category_id: string; name: string; icon: string; tint: string;
  budget: string; spent: string;
};

/** Every category with what it was given this month and what has gone out of
 *  it. Spending comes from `spend_txn`, never from `txn` — that view is where
 *  "a transfer is not spending" and "a refund nets off" actually live. */
export async function budgetFor(householdId: string, month: string) {
  return sql`
    select c.id as category_id, c.name, c.icon, c.tint,
           coalesce(b.amount, 0)::text as budget,
           coalesce((
             select sum(s.amount) from spend_txn s
             where s.category_id = c.id
               and s.occurred_on >= ${month}::date
               and s.occurred_on <  (${month}::date + interval '1 month')
           ), 0)::text as spent
    from category c
    left join budget b on b.category_id = c.id and b.month = ${month}::date
    where c.household_id = ${householdId} and c.archived_at is null
    order by coalesce(b.amount, 0) desc, c.sort_order
  ` as Promise<BudgetRow[]>;
}

/** The month in one line: what was budgeted, what has gone, what came in. */
export async function monthTotals(householdId: string, month: string) {
  const [r] = await sql`
    select
      coalesce((select sum(amount) from budget
                where household_id = ${householdId} and month = ${month}::date), 0)::text as budget,
      coalesce((select sum(amount) from spend_txn
                where household_id = ${householdId}
                  and occurred_on >= ${month}::date
                  and occurred_on <  (${month}::date + interval '1 month')), 0)::text as spent,
      coalesce((select sum(amount) from income_txn
                where household_id = ${householdId}
                  and occurred_on >= ${month}::date
                  and occurred_on <  (${month}::date + interval '1 month')), 0)::text as income,
      (select count(*)::int from txn
        where household_id = ${householdId} and deleted_at is null
          and occurred_on >= ${month}::date
          and occurred_on <  (${month}::date + interval '1 month')) as entries`;
  return r as unknown as { budget: string; spent: string; income: string; entries: number };
}

/** Whether there is an earlier month to copy from, and what it came to. */
export async function previousBudget(householdId: string, month: string) {
  const [r] = await sql`
    select b.month, sum(b.amount)::text as total, count(*)::int as categories
    from budget b
    where b.household_id = ${householdId} and b.month < ${month}::date
    group by b.month order by b.month desc limit 1`;
  return (r ?? null) as null | { month: Date; total: string; categories: number };
}

/* ── the ledger ─────────────────────────────────────────────────────────── */

export type EntryRow = {
  id: string; kind: string; amount: string; occurred_on: Date;
  merchant: string | null; note: string | null; is_shared: boolean;
  category_id: string | null; category: string | null; tint: string | null;
  method: string | null; account: string; counter_account: string | null;
  who: string; created_at: Date;
};

/** A month of entries, newest first, optionally narrowed to one category —
 *  which is what makes a budget line answerable rather than just a number. */
export async function entriesFor(
  householdId: string, month: string, categoryId?: string | null,
) {
  return sql`
    select t.id, t.kind, t.amount::text, t.occurred_on, t.merchant, t.note, t.is_shared,
           t.category_id, c.name as category, c.tint,
           m.name as method, a.name as account, ca.name as counter_account,
           u.name as who, t.created_at
    from txn t
    join account a on a.id = t.account_id
    left join account ca on ca.id = t.counter_account_id
    left join category c on c.id = t.category_id
    left join payment_method m on m.id = t.payment_method_id
    join app_user u on u.id = t.created_by
    where t.household_id = ${householdId}
      and t.deleted_at is null
      and t.occurred_on >= ${month}::date
      and t.occurred_on <  (${month}::date + interval '1 month')
      and (${categoryId ?? null}::uuid is null or t.category_id = ${categoryId ?? null}::uuid)
    order by t.occurred_on desc, t.created_at desc
  ` as Promise<EntryRow[]>;
}

export async function entryById(householdId: string, id: string) {
  const [r] = await sql`
    select t.id, t.kind, t.amount::text, t.occurred_on, t.merchant, t.note, t.is_shared,
           t.category_id, t.payment_method_id, t.counter_account_id,
           c.name as category, c.tint, m.name as method,
           a.name as account, ca.name as counter_account, u.name as who, t.created_at
    from txn t
    join account a on a.id = t.account_id
    left join account ca on ca.id = t.counter_account_id
    left join category c on c.id = t.category_id
    left join payment_method m on m.id = t.payment_method_id
    join app_user u on u.id = t.created_by
    where t.id = ${id} and t.household_id = ${householdId} and t.deleted_at is null`;
  return (r ?? null) as null | (EntryRow & {
    payment_method_id: string | null; counter_account_id: string | null });
}

/* ── the khata: money lent, money owed ──────────────────────────────────── */

export type PersonRow = {
  id: string; name: string; relationship: string; tint: string;
  account_id: string; balance: string; entries: number; last_on: Date | null;
};

/** Everyone the household has money between it and, with the running balance.
 *  Positive means they owe you; negative means you owe them. */
export async function peopleFor(householdId: string) {
  return sql`
    select c.id, c.name, c.relationship, c.tint, c.account_id,
           b.balance::text,
           (select count(*)::int from txn t
             where (t.account_id = c.account_id or t.counter_account_id = c.account_id)
               and t.deleted_at is null) as entries,
           (select max(t.occurred_on) from txn t
             where (t.account_id = c.account_id or t.counter_account_id = c.account_id)
               and t.deleted_at is null) as last_on
    from counterparty c
    join counterparty_balance b on b.counterparty_id = c.id
    where c.household_id = ${householdId} and c.archived_at is null
    order by abs(b.balance) desc, c.name
  ` as Promise<PersonRow[]>;
}

export async function personById(householdId: string, id: string) {
  const [r] = await sql`
    select c.id, c.name, c.relationship, c.tint, c.account_id, c.phone,
           b.balance::text
    from counterparty c
    join counterparty_balance b on b.counterparty_id = c.id
    where c.id = ${id} and c.household_id = ${householdId} and c.archived_at is null`;
  return (r ?? null) as null | (PersonRow & { phone: string | null });
}

/** Everything that has moved between the household and one person. The sign is
 *  from THEIR side: positive means the debt grew. */
export async function personLedger(householdId: string, accountId: string) {
  return sql`
    select t.id, t.kind, t.occurred_on, t.merchant, t.note, t.amount::text,
           case when t.counter_account_id = ${accountId} then 'lent'
                when t.kind = 'expense' then 'written_off'
                else 'back' end as direction,
           coalesce(oa.name, ca.name) as other_side,
           u.name as who, c.name as category
    from txn t
    left join account oa on oa.id = t.account_id and t.account_id <> ${accountId}
    left join account ca on ca.id = t.counter_account_id and t.counter_account_id <> ${accountId}
    left join category c on c.id = t.category_id
    join app_user u on u.id = t.created_by
    where t.household_id = ${householdId} and t.deleted_at is null
      and (t.account_id = ${accountId} or t.counter_account_id = ${accountId})
    order by t.occurred_on desc, t.created_at desc
  ` as Promise<{ id: string; kind: string; occurred_on: Date; merchant: string | null;
                 note: string | null; amount: string; direction: 'lent' | 'back' | 'written_off';
                 other_side: string | null; who: string; category: string | null }[]>;
}

/** The books people are filed into, with what each one comes to. */
export async function booksFor(householdId: string) {
  return sql`
    select b.id, b.kind, b.name, b.note, b.closed_at,
           count(bm.counterparty_id)::int as people,
           coalesce(sum(cb.balance), 0)::text as balance
    from ledger_book b
    left join book_member bm on bm.book_id = b.id
    left join counterparty_balance cb on cb.counterparty_id = bm.counterparty_id
    where b.household_id = ${householdId}
    group by b.id
    order by b.closed_at nulls first, b.name
  ` as Promise<{ id: string; kind: 'loan' | 'reimbursement'; name: string; note: string | null;
                 closed_at: Date | null; people: number; balance: string }[]>;
}

export async function bookMembership(householdId: string) {
  return sql`
    select bm.book_id, bm.counterparty_id
    from book_member bm join ledger_book b on b.id = bm.book_id
    where b.household_id = ${householdId}
  ` as Promise<{ book_id: string; counterparty_id: string }[]>;
}

/* ── claims: money owed for things you already paid for ─────────────────── */

export type ClaimRow = {
  id: string; counterparty_id: string; person: string; tint: string;
  txn_id: string; expected_amount: string; received: string; outstanding: string;
  status: 'open' | 'part_paid' | 'settled' | 'written_off';
  note: string | null; merchant: string | null; category: string | null;
  occurred_on: Date; txn_amount: string;
};

export async function claimsFor(householdId: string, counterpartyId?: string) {
  return sql`
    select cs.id, cs.counterparty_id, cp.name as person, cp.tint, cs.txn_id,
           cs.expected_amount::text, cs.received::text, cs.outstanding::text, cs.status,
           cs.note, t.merchant, c.name as category, t.occurred_on, t.amount::text as txn_amount
    from claim_state cs
    join counterparty cp on cp.id = cs.counterparty_id
    join txn t on t.id = cs.txn_id and t.deleted_at is null
    left join category c on c.id = t.category_id
    where cs.household_id = ${householdId}
      and (${counterpartyId ?? null}::uuid is null
           or cs.counterparty_id = ${counterpartyId ?? null}::uuid)
    order by case cs.status when 'open' then 0 when 'part_paid' then 1 else 2 end,
             t.occurred_on desc
  ` as Promise<ClaimRow[]>;
}

/** Claims attached to one entry, for the entry's own screen. */
export async function claimsOnEntry(householdId: string, txnId: string) {
  return sql`
    select cs.id, cs.counterparty_id, cp.name as person, cp.tint,
           cs.expected_amount::text, cs.received::text, cs.outstanding::text, cs.status, cs.note
    from claim_state cs
    join counterparty cp on cp.id = cs.counterparty_id
    where cs.household_id = ${householdId} and cs.txn_id = ${txnId}
    order by cp.name
  ` as Promise<{ id: string; counterparty_id: string; person: string; tint: string;
                 expected_amount: string; received: string; outstanding: string;
                 status: string; note: string | null }[]>;
}

/** What each person owes, both ways, in one row. */
export async function owedByPerson(householdId: string) {
  return sql`
    select cp.id, cp.name, cp.tint,
           b.balance::text as lent,
           cc.owed::text as claimed,
           cc.open_claims
    from counterparty cp
    join counterparty_balance b on b.counterparty_id = cp.id
    join counterparty_claims cc on cc.counterparty_id = cp.id
    where cp.household_id = ${householdId} and cp.archived_at is null
  ` as Promise<{ id: string; name: string; tint: string; lent: string;
                 claimed: string; open_claims: number }[]>;
}
