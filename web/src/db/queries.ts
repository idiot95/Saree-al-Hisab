import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { sql } from './client';
import { auth } from '@/auth';
import { contextFor } from './membership';
import { hashLinkToken } from '@/lib/link-token';
import { setCurrencyResolver } from '@/lib/money';

/* Who is asking, and what they may do — resolved on the server, on every
   request, in a single round trip.

   Three things are checked here and nowhere else:
     · the session cookie is real (Auth.js has already verified its signature);
     · it was issued AFTER the account's session epoch, so a cookie that walked
       out of the door before a password change is refused;
     · the role comes from the database, so a demotion or a removal bites on
       the next tap rather than at the next sign-in.

   A Server Action is reachable by direct POST, so the household a write lands
   in is decided here and nowhere else.

   Resolved once per request, however many times it is asked for: the layout
   wants the currency, the page wants the household, and React's cache() hands
   both the same answer from the same round trip. */
const resolve = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const c = await contextFor(session.user.id, session.issuedAt ?? 0);
  if (!c || c.stale) return null;
  requestCurrency().code = c.currency;
  return { session, c };
});

/* The currency every bare format() in this request means. Per request, not
   per process: cache() is scoped to the render, so two households served by
   the same instance at the same moment never see each other's symbol. Client
   components cannot reach this and read theirs from context instead
   (app/currency.tsx). */
const requestCurrency = cache(() => ({ code: '' }));
setCurrencyResolver(() => requestCurrency().code || 'INR');

export async function currentActor() {
  const r = await resolve();
  // A cookie older than the account's session epoch is not an error to report,
  // it is somebody who has been signed out. Send them to sign in again.
  if (!r) redirect('/signin');
  const { session, c } = r;
  if (!c.household_id) redirect('/no-household');
  return {
    household_id: c.household_id,
    user_id: session.user!.id!,
    role: c.role!,
    user_name: session.user?.name ?? '',
    household_name: c.household_name ?? 'Household',
    currency: c.currency,
  };
}

/** For pages that need to tell the three states apart: signed out, signed in
 *  without a household, and signed in with one. A stale cookie counts as
 *  signed out. */
export async function actorOrNull() {
  const r = await resolve();
  if (!r) return null;
  const { session, c } = r;
  return {
    household_id: c.household_id,
    user_id: session.user!.id!,
    role: c.role,
    user_name: session.user?.name ?? '',
    household_name: c.household_name ?? 'Household',
    currency: c.currency,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
  };
}

/** How many entries the books hold — the one number that decides whether
 *  their currency may still change. */
export async function entryCount(householdId: string) {
  const [{ n }] = await sql`select count(*)::int as n from txn where household_id = ${householdId}`;
  return n as number;
}

/** Every live category, each child straight after its parent, so a flat list
 *  reads as the tree it is. `parent` is the parent's name — what a picker
 *  shows beside "Milk" so it is not mistaken for a category on its own. */
export async function categoriesFor(householdId: string) {
  return sql`
    select c.id, c.name, c.icon, c.tint, c.parent_id, p.name as parent
    from category c
    left join category p on p.id = c.parent_id
    where c.household_id = ${householdId} and c.archived_at is null
    order by coalesce(p.sort_order, c.sort_order), (c.parent_id is not null), c.sort_order, c.name
  ` as Promise<{ id: string; name: string; icon: string; tint: string;
                 parent_id: string | null; parent: string | null }[]>;
}

export async function methodsFor(householdId: string) {
  return sql`
    select m.id, m.name, m.kind, m.handle, m.funding_account_id as funds_id,
           a.name as funds, a.kind as funds_kind
    from payment_method m
    join account a on a.id = m.funding_account_id
    where m.household_id = ${householdId} and m.archived_at is null
    order by m.sort_order` as Promise<
      { id: string; name: string; kind: string; handle: string | null;
        funds_id: string; funds: string; funds_kind: string }[]>;
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
  budget: string; spent: string; archived: boolean;
  /** The children with money out this month, largest first — "of which". */
  kids: { id: string; name: string; icon: string; spent: string }[];
};

/** Every parent category with what it was given this month and what has gone
 *  out of it — its own spending and its children's together, because the
 *  budget line is the parent's and a child rolls up into it. Spending comes
 *  from `spend_txn`, never from `txn` — that view is where "a transfer is not
 *  spending" and "a refund nets off" actually live. A budget row a child
 *  earned before it moved under a parent rolls up the same way, so the lines
 *  still add up to the month's total. */
export async function budgetFor(householdId: string, month: string) {
  return sql`
    with fam as (
      select c.id, c.name, c.icon, c.tint, c.sort_order, c.archived_at,
             array_prepend(c.id, coalesce(array_agg(k.id) filter (where k.id is not null), '{}')) as ids
      from category c
      left join category k on k.parent_id = c.id
      where c.household_id = ${householdId} and c.parent_id is null
      group by c.id
    ),
    spent as (
      select s.category_id, sum(s.amount) as amount
      from spend_txn s
      where s.household_id = ${householdId}
        and s.occurred_on >= ${month}::date
        and s.occurred_on <  (${month}::date + interval '1 month')
      group by s.category_id
    )
    select f.id as category_id, f.name, f.icon, f.tint,
           (f.archived_at is not null) as archived,
           coalesce((select sum(b.amount) from budget b
                     where b.category_id = any(f.ids) and b.month = ${month}::date), 0)::text as budget,
           coalesce((select sum(sp.amount) from spent sp where sp.category_id = any(f.ids)), 0)::text as spent,
           coalesce((
             select json_agg(json_build_object('id', k.id, 'name', k.name, 'icon', k.icon,
                                               'spent', sp.amount::text)
                             order by sp.amount desc)
             from category k join spent sp on sp.category_id = k.id
             where k.parent_id = f.id
           ), '[]'::json) as kids
    from fam f
    where (
        f.archived_at is null
        /* A retired category still belongs in a month it had money in.
           Dropping it would leave the rows failing to add up to the total —
           the same figure, disagreeing with itself on one screen. */
        or exists (select 1 from budget b where b.category_id = any(f.ids) and b.month = ${month}::date)
        or exists (select 1 from spent sp where sp.category_id = any(f.ids))
      )
    order by (select coalesce(sum(b.amount), 0) from budget b
              where b.category_id = any(f.ids) and b.month = ${month}::date) desc, f.sort_order
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
  icon: string | null;
  method: string | null; account: string; counter_account: string | null;
  who: string; created_at: Date;
  /* The counterparty on either side of the entry, if there is one, and which
     side they are on — so lending never reads back as a repayment. */
  people: string | null; to_person: boolean; from_person: boolean;
  /** Money arriving against a claim: somebody paying you back. */
  settles: boolean;
  /** False on a cost you laid out for someone: it left your account but was
   *  never yours to spend, so no chart counts it. */
  counts_as_spend: boolean;
  book_id: string | null;
};

/** A month of entries, newest first, optionally narrowed to one category —
 *  which is what makes a budget line answerable rather than just a number. */
export async function entriesFor(
  householdId: string, month: string, categoryId?: string | null,
) {
  return sql`
    select t.id, t.kind, t.amount::text, t.occurred_on, t.merchant, t.note, t.is_shared,
           t.counts_as_spend, t.book_id, t.category_id,
           c.name as category, c.tint, c.icon,
           m.name as method, a.name as account, ca.name as counter_account,
           coalesce(cp.name, rcp.name) as people,
           (ca.kind = 'person') as to_person,
           (a.kind = 'person') as from_person,
           (t.claim_id is not null) as settles,
           u.name as who, t.created_at
    from txn t
    join account a on a.id = t.account_id
    left join account ca on ca.id = t.counter_account_id
    left join counterparty cp on cp.account_id in (t.counter_account_id, t.account_id)
    left join claim cl on cl.id = t.claim_id
    left join counterparty rcp on rcp.id = cl.counterparty_id
    left join category c on c.id = t.category_id
    left join payment_method m on m.id = t.payment_method_id
    join app_user u on u.id = t.created_by
    where t.household_id = ${householdId}
      and t.deleted_at is null
      and t.occurred_on >= ${month}::date
      and t.occurred_on <  (${month}::date + interval '1 month')
      and (${categoryId ?? null}::uuid is null
           or t.category_id = ${categoryId ?? null}::uuid
           or c.parent_id = ${categoryId ?? null}::uuid)
    order by t.occurred_on desc, t.created_at desc
  ` as Promise<EntryRow[]>;
}

export async function entryById(householdId: string, id: string) {
  const [r] = await sql`
    select t.id, t.kind, t.amount::text, t.occurred_on, t.merchant, t.note, t.is_shared,
           t.category_id, t.payment_method_id, t.counter_account_id, t.book_id, t.counts_as_spend,
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
    payment_method_id: string | null; counter_account_id: string | null;
    book_id: string | null; counts_as_spend: boolean });
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

/* ── tabs: people you cover costs for ───────────────────────────────────── */

export type TabRow = {
  id: string; name: string; note: string | null;
  closed_at: Date | null; people: number; entries: number; outstanding: string;
};

/** Every tab, with how many are on it and what is still owed across it. The
 *  outstanding figure comes from tab_balance — money laid out under this tab
 *  less money that has come back under it — so it can never disagree with the
 *  khata, which is the same arithmetic without the tab in the way. */
export async function tabList(householdId: string) {
  return sql`
    select b.id, b.name, b.note, b.closed_at,
           (select count(*)::int from book_member bm where bm.book_id = b.id) as people,
           (select count(*)::int from txn t
             where t.book_id = b.id and t.deleted_at is null) as entries,
           coalesce((select sum(tb.outstanding) from tab_balance tb
                      where tb.book_id = b.id), 0)::text as outstanding
    from ledger_book b
    where b.household_id = ${householdId}
    order by (b.closed_at is not null), b.name
  ` as Promise<TabRow[]>;
}

export async function tabById(householdId: string, id: string) {
  const [b] = await sql`
    select id, name, note, closed_at from ledger_book
    where id = ${id} and household_id = ${householdId}`;
  return (b ?? null) as null | {
    id: string; name: string; note: string | null; closed_at: Date | null };
}

/** The open tabs a cost can be put on — only those with someone on them,
 *  because money laid out for nobody is not laid out. `last_counts` is what
 *  the most recent cost on the tab answered to "was this my spending?" — the
 *  question is asked afresh on every entry, but the last answer is the best
 *  guess at the next, because petrol on the office tab is petrol every week. */
export async function tabsForEntry(householdId: string) {
  return sql`
    select b.id, b.name,
           (select count(*)::int from book_member bm where bm.book_id = b.id) as people,
           (select t.counts_as_spend from txn t
             where t.book_id = b.id and t.deleted_at is null
             order by t.occurred_on desc, t.created_at desc limit 1) as last_counts
    from ledger_book b
    where b.household_id = ${householdId} and b.closed_at is null
      and exists (select 1 from book_member bm where bm.book_id = b.id)
    order by b.name
  ` as Promise<{ id: string; name: string; people: number; last_counts: boolean | null }[]>;
}

/** Everyone in the household, flagged for whether they are on this tab, with
 *  what has gone out to them under it and what has come back — one query, so
 *  the member list and the "add someone" picker cannot disagree. Somebody who
 *  has left the tab still appears while they owe for what came before. */
export async function peopleForTab(householdId: string, tabId: string) {
  return sql`
    select cp.id, cp.name, cp.tint,
           (bm.book_id is not null) as on_tab,
           coalesce(tb.owed_in_all, 0)::text as owed_in_all,
           coalesce(tb.back, 0)::text as back,
           coalesce(tb.outstanding, 0)::text as owed
    from counterparty cp
    left join book_member bm on bm.counterparty_id = cp.id and bm.book_id = ${tabId}
    left join tab_balance tb on tb.counterparty_id = cp.id and tb.book_id = ${tabId}
    where cp.household_id = ${householdId} and cp.archived_at is null
    order by (bm.book_id is null), cp.name
  ` as Promise<{ id: string; name: string; tint: string; on_tab: boolean;
                 owed_in_all: string; back: string; owed: string }[]>;
}

/** What has been put on a tab and what has come back, newest first. Costs are
 *  the entries filed under it; receipts are the money that has come back
 *  against their claims, which reaches the tab through the claim rather than
 *  a column of its own. */
export async function tabEntries(householdId: string, tabId: string) {
  return sql`
    select t.id::text as id, t.occurred_on, t.merchant, t.amount::text as amount,
           t.counts_as_spend, false as incoming,
           coalesce((select sum(cs.expected_amount) from claim_state cs
                      where cs.txn_id = t.id and cs.written_off_at is null), 0)::text as owed_in_all,
           coalesce((select sum(cs.outstanding) from claim_state cs
                      where cs.txn_id = t.id and cs.written_off_at is null), 0)::text as outstanding,
           u.name as who, c.name as category, c.icon, c.tint,
           (select string_agg(distinct cp.name, ', ') from claim cl
             join counterparty cp on cp.id = cl.counterparty_id
             where cl.txn_id = t.id) as people
    from txn t
    join app_user u on u.id = t.created_by
    left join category c on c.id = t.category_id
    where t.household_id = ${householdId} and t.book_id = ${tabId} and t.deleted_at is null

    union all

    select r.id::text, r.occurred_on, null, r.amount::text,
           false, true, '0', '0',
           u.name, null, null, null, cp.name
    from txn r
    join claim cl on cl.id = r.claim_id
    join txn t on t.id = cl.txn_id and t.book_id = ${tabId} and t.deleted_at is null
    join counterparty cp on cp.id = cl.counterparty_id
    join app_user u on u.id = r.created_by
    where r.household_id = ${householdId} and r.kind = 'claim_receipt' and r.deleted_at is null

    order by occurred_on desc
  ` as Promise<{ id: string; occurred_on: Date; merchant: string | null; amount: string;
                 counts_as_spend: boolean; incoming: boolean; owed_in_all: string;
                 outstanding: string; who: string; category: string | null;
                 icon: string | null; tint: string | null; people: string | null }[]>;
}

/** Every claim still open, across every tab and every person, for the moment
 *  money arrives: the income screen lists these so the ₹10,000 that landed can
 *  be pointed at the three entries it clears. Oldest first, which is the order
 *  a part payment is spread in. */
export type OpenClaim = {
  id: string; counterparty_id: string; person: string; tint: string; tab: string | null;
  what: string; occurred_on: Date; outstanding: string;
};
export async function openClaimsFor(householdId: string, tabId?: string) {
  return sql`
    select cs.id, cs.counterparty_id, cp.name as person, cp.tint, b.name as tab,
           coalesce(t.merchant, c.name, 'Cost') as what,
           t.occurred_on, cs.outstanding::text
    from claim_state cs
    join txn t on t.id = cs.txn_id and t.deleted_at is null
    join counterparty cp on cp.id = cs.counterparty_id
    left join ledger_book b on b.id = t.book_id
    left join category c on c.id = t.category_id
    where cs.household_id = ${householdId} and cs.status in ('open', 'part_paid')
      ${tabId ? sql`and t.book_id = ${tabId}` : sql``}
    order by t.occurred_on, t.created_at
  ` as Promise<OpenClaim[]>;
}

/* ── trends ─────────────────────────────────────────────────────────────── */

export type MonthPoint = {
  month: string; spent: string; income: string; budget: string; entries: number;
};

/** The last N months, including ones with nothing in them — a gap in the bars
 *  is information, and dropping empty months would quietly close it up. */
export async function monthlySeries(householdId: string, months = 6) {
  return sql`
    with span as (
      select generate_series(
        date_trunc('month', current_date) - make_interval(months => ${months - 1}),
        date_trunc('month', current_date),
        interval '1 month')::date as month
    )
    select to_char(s.month, 'YYYY-MM-DD') as month,
           coalesce((select sum(amount) from spend_txn t
                     where t.household_id = ${householdId}
                       and t.occurred_on >= s.month
                       and t.occurred_on <  (s.month + interval '1 month')), 0)::text as spent,
           coalesce((select sum(amount) from income_txn t
                     where t.household_id = ${householdId}
                       and t.occurred_on >= s.month
                       and t.occurred_on <  (s.month + interval '1 month')), 0)::text as income,
           coalesce((select sum(amount) from budget b
                     where b.household_id = ${householdId} and b.month = s.month), 0)::text as budget,
           (select count(*)::int from txn t
             where t.household_id = ${householdId} and t.deleted_at is null
               and t.occurred_on >= s.month
               and t.occurred_on <  (s.month + interval '1 month')) as entries
    from span s
    order by s.month
  ` as Promise<MonthPoint[]>;
}

/** What each category came to in a month, and what it came to the month
 *  before — the comparison is the point, so both are fetched together. */
export async function categoryTrend(householdId: string, month: string) {
  return sql`
    with fam as (
      select c.id, c.name, c.tint, c.icon, c.sort_order, c.archived_at,
             array_prepend(c.id, coalesce(array_agg(k.id) filter (where k.id is not null), '{}')) as ids
      from category c
      left join category k on k.parent_id = c.id
      where c.household_id = ${householdId} and c.parent_id is null
      group by c.id
    )
    select f.id, f.name, f.tint, f.icon,
           coalesce((select sum(s.amount) from spend_txn s
                     where s.category_id = any(f.ids)
                       and s.occurred_on >= ${month}::date
                       and s.occurred_on <  (${month}::date + interval '1 month')), 0)::text as now,
           coalesce((select sum(s.amount) from spend_txn s
                     where s.category_id = any(f.ids)
                       and s.occurred_on >= (${month}::date - interval '1 month')
                       and s.occurred_on <  ${month}::date), 0)::text as before,
           coalesce((select sum(b.amount) from budget b
                     where b.category_id = any(f.ids) and b.month = ${month}::date), 0)::text as budget
    from fam f
    where f.archived_at is null
       or exists (select 1 from spend_txn s where s.category_id = any(f.ids)
                    and s.occurred_on >= (${month}::date - interval '1 month'))
    order by f.sort_order
  ` as Promise<{ id: string; name: string; tint: string; icon: string;
                 now: string; before: string; budget: string }[]>;
}

/* ── the inbox: things worth a decision ─────────────────────────────────── */

export type DuplicatePair = {
  low_id: string; high_id: string; reason: 'same_account' | 'two_people';
  low_amount: string; high_amount: string;
  low_on: Date; high_on: Date;
  low_merchant: string | null; high_merchant: string | null;
  low_who: string; high_who: string;
  low_account: string; high_account: string;
  low_category: string | null; high_category: string | null;
};

/** Pairs the database thinks might be the same purchase twice. Detected, never
 *  prevented — two identical coffees in a day is legitimate — so this is a
 *  queue of decisions, not a list of errors. */
export async function duplicatesFor(householdId: string) {
  return sql`
    select d.low_id, d.high_id, d.reason,
           lo.amount::text as low_amount, hi.amount::text as high_amount,
           lo.occurred_on as low_on, hi.occurred_on as high_on,
           lo.merchant as low_merchant, hi.merchant as high_merchant,
           lu.name as low_who, hu.name as high_who,
           la.name as low_account, ha.name as high_account,
           lc.name as low_category, hc.name as high_category
    from duplicate_candidate d
    join txn lo on lo.id = d.low_id
    join txn hi on hi.id = d.high_id
    join app_user lu on lu.id = lo.created_by
    join app_user hu on hu.id = hi.created_by
    join account la on la.id = lo.account_id
    join account ha on ha.id = hi.account_id
    left join category lc on lc.id = lo.category_id
    left join category hc on hc.id = hi.category_id
    where d.household_id = ${householdId}
    order by hi.occurred_on desc
  ` as Promise<DuplicatePair[]>;
}

/** Card bills with a due date coming up.
 *
 *  Deliberately NOT card_open_cycle: that view returns the newest open cycle
 *  per card, which is right for "what is riding on this card right now" and
 *  exactly wrong here. The bill that needs paying is the OLDEST unpaid one, and
 *  going through card_open_cycle hid a bill due in five days behind the cycle
 *  that had only just opened. */
export async function billsDue(householdId: string, withinDays = 21) {
  return sql`
    select c.account_id, a.name as account, a.last4,
           c.period_start, c.period_end, c.due_on, c.charged::text, c.entries::int,
           (c.due_on - current_date)::int as days_away
    from card_cycle_total c
    join account a on a.id = c.account_id
    where a.household_id = ${householdId}
      and c.status <> 'paid'
      and c.charged > 0
      and c.due_on <= current_date + ${withinDays}::int
    order by c.due_on
  ` as Promise<{ account_id: string; account: string; last4: string | null;
                 period_start: Date; period_end: Date; due_on: Date;
                 charged: string; entries: number; days_away: number }[]>;
}

/** Just the count, for the home screen. Cheap enough to run on every load,
 *  which is the point — an inbox nobody is told about is not an inbox. */
export async function inboxCount(householdId: string) {
  const [r] = await sql`
    select
      (select count(*)::int from duplicate_candidate
        where household_id = ${householdId}) as duplicates,
      (select count(*)::int from card_cycle_total c
        join account a on a.id = c.account_id
        where a.household_id = ${householdId} and c.status <> 'paid' and c.charged > 0
          and c.due_on <= current_date + 21) as bills`;
  return r as unknown as { duplicates: number; bills: number };
}

/* ── scheduled payments ─────────────────────────────────────────────────── */

export type ScheduleRow = {
  id: string; name: string; kind: 'expense' | 'income';
  amount: string | null; amount_from_statement: boolean;
  /** One of the two is set: a rule on the Gregorian calendar, or the same
   *  grammar on the Hijri (Misri) one. See src/lib/recur.ts. */
  rrule: string | null; hijri_rule: string | null;
  account_id: string; account: string;
  /** Dues before this are not owed: the later of when the schedule was
   *  made and when its rule was last rewritten. */
  since: string;
  category_id: string | null; category: string | null; tint: string | null;
  icon: string | null;
  /** Rule dates that have been dealt with — paid or skipped. */
  settled: string[];
  /** Rule dates that were moved and not yet dealt with: the due is at `to`. */
  moved: { from: string; to: string }[];
  /** Everything ever recorded against the schedule, for the calendar. */
  occurrences: { on: string; status: 'pending' | 'paid' | 'skipped'; to: string | null; txn: string | null }[];
};

/* Nothing is materialised ahead of time. Upcoming dates are worked out from
   the rule when they are asked for, and an `occurrence` row is written only
   when something HAPPENS to one — paid, or skipped. There is no scheduler to
   run, nothing to backfill, and a schedule created today is immediately right
   about next month without a job having visited it. */
export async function schedulesFor(householdId: string) {
  return sql`
    select s.id, s.name, s.kind, s.amount::text, s.amount_from_statement, s.rrule, s.hijri_rule,
           s.account_id, a.name as account,
           to_char(greatest(s.created_at::date, s.rule_since), 'YYYY-MM-DD') as since,
           s.category_id, c.name as category, c.tint, c.icon,
           coalesce(array_agg(to_char(o.due_on, 'YYYY-MM-DD'))
                    filter (where o.status <> 'pending'), '{}') as settled,
           coalesce(json_agg(json_build_object('from', to_char(o.due_on, 'YYYY-MM-DD'),
                                               'to', to_char(o.shifted_to, 'YYYY-MM-DD')))
                    filter (where o.status = 'pending'), '[]') as moved,
           coalesce(json_agg(json_build_object('on', to_char(o.due_on, 'YYYY-MM-DD'),
                                               'status', o.status,
                                               'to', to_char(o.shifted_to, 'YYYY-MM-DD'),
                                               'txn', o.txn_id) order by o.due_on)
                    filter (where o.id is not null), '[]') as occurrences
    from schedule s
    join account a on a.id = s.account_id
    left join category c on c.id = s.category_id
    left join occurrence o on o.schedule_id = s.id
                          and o.due_on >= current_date - 400
    where s.household_id = ${householdId} and s.archived_at is null
    group by s.id, a.name, c.name, c.tint, c.icon
    order by s.name
  ` as Promise<ScheduleRow[]>;
}

/* ── what the household is actually worth ───────────────────────────────── */

export type WorthRow = {
  id: string; name: string; kind: string; last4: string | null; balance: string;
};

/** Every account with its balance, people included. A person's account IS the
 *  khata, so someone owing you is an asset and you owing them is a liability,
 *  computed the same way as everything else rather than tallied separately. */
export async function allBalances(householdId: string) {
  return sql`
    select b.id, b.name, b.kind, b.last4, b.balance::text
    from account_balance b
    where b.household_id = ${householdId} and b.archived_at is null
    order by case b.kind when 'spending' then 0 when 'cash' then 1 when 'savings' then 2
                         when 'person' then 3 else 4 end, b.name
  ` as Promise<WorthRow[]>;
}

/* What was held in accounts at the end of each of the last N months.
 *
 * Deliberately the household's own accounts only — no people. An outstanding
 * claim or a loan is money owed to you today and is in the headline figure,
 * but reconstructing what was outstanding on a date months ago would need a
 * history this app does not keep — so the series says "held in accounts" and
 * means it, rather than implying a precision it cannot support. */
export async function worthSeries(householdId: string, months = 6) {
  return sql`
    with span as (
      select generate_series(
        date_trunc('month', current_date) - make_interval(months => ${months - 1}),
        date_trunc('month', current_date),
        interval '1 month')::date as month
    )
    select to_char(s.month, 'YYYY-MM-DD') as month,
           (
             coalesce((select sum(a.opening_balance) from account a
                       where a.household_id = ${householdId} and a.archived_at is null
                         and a.kind <> 'person'), 0)
             + coalesce((
                 select sum(case
                   when t.account_id = a.id
                        and t.kind in ('expense','transfer','card_payment') then -t.amount
                   when t.account_id = a.id
                        and t.kind in ('income','claim_receipt','refund')   then  t.amount
                   when t.counter_account_id = a.id                          then  t.amount
                   else 0 end)
                 from txn t
                 join account a on a.id = t.account_id or a.id = t.counter_account_id
                 where t.household_id = ${householdId}
                   and t.deleted_at is null
                   and a.archived_at is null
                   and a.kind <> 'person'
                   and t.occurred_on < (s.month + interval '1 month')), 0)
           )::text as held
    from span s
    order by s.month
  ` as Promise<{ month: string; held: string }[]>;
}

/** Whether this household can scan, without handing the key to the caller. */
export async function scanningState(householdId: string) {
  const [r] = await sql`
    select gemini_key is not null as has_key,
           to_char(gemini_key_set_at, 'FMDD Mon YYYY') as set_on
    from household where id = ${householdId}`;
  return r as unknown as { has_key: boolean; set_on: string | null };
}

/** The sealed key itself. Only ever called on the server, by the scan action. */
export async function geminiKeyFor(householdId: string) {
  const [r] = await sql`select gemini_key from household where id = ${householdId}`;
  return (r?.gemini_key as string | null) ?? null;
}

/* ── categories ─────────────────────────────────────────────────────────── */

export type CategoryRow = {
  id: string; name: string; icon: string; tint: string; sort_order: number;
  parent_id: string | null; children: number;
  archived: boolean; entries: number; budgeted_months: number;
};

/** Every category, retired ones included, with how much is riding on each —
 *  because "can I retire this" is answered by what is already filed under it.
 *  Children follow their parent, live ones first within each. */
export async function allCategories(householdId: string) {
  return sql`
    select c.id, c.name, c.icon, c.tint, c.sort_order, c.parent_id,
           (select count(*)::int from category k
             where k.parent_id = c.id and k.archived_at is null) as children,
           (c.archived_at is not null) as archived,
           (select count(*)::int from txn t
             where t.category_id = c.id and t.deleted_at is null) as entries,
           (select count(*)::int from budget b where b.category_id = c.id) as budgeted_months
    from category c
    left join category p on p.id = c.parent_id
    where c.household_id = ${householdId}
    order by (coalesce(p.archived_at, c.archived_at) is not null),
             coalesce(p.sort_order, c.sort_order), (c.parent_id is not null),
             (c.archived_at is not null), c.sort_order, c.name
  ` as Promise<CategoryRow[]>;
}
