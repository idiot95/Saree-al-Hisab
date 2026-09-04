import 'server-only';
import { sql } from './client';
import { auth } from '@/auth';

/* Who is asking, from the session — never from the client. A Server Action is
   reachable by direct POST, so the household a write lands in is decided here
   and nowhere else. */
export async function currentActor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Not signed in.');
  if (!session.householdId) throw new Error('No household yet.');
  return {
    household_id: session.householdId,
    user_id: session.user.id,
    role: session.role,
    user_name: session.user.name ?? '',
  };
}

/** For pages that need to tell the three states apart: signed out, signed in
 *  without a household, and signed in with one. */
export async function actorOrNull() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    household_id: session.householdId,
    user_id: session.user.id,
    role: session.role,
    user_name: session.user.name ?? '',
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
