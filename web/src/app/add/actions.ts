'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor, possibleDuplicate } from '@/db/queries';
import { breakdown } from '../tab/splits';

/* A Server Action is reachable by direct POST, not only through the UI, so
   every value the client sends is treated as untrusted: the household and the
   author come from the server, and every id is checked to belong to that
   household before it is written. The database would refuse a foreign key
   anyway, but it would not stop one household writing into another's. */

export type Draft = {
  kind: 'expense' | 'income' | 'transfer';
  amountMinor: number;
  categoryId: string | null;
  methodId: string;
  counterAccountId: string | null;
  merchant: string;
  occurredOn: string;
  isShared: boolean;
  /** The tab this cost is put on, if any: the people on it are lent their
      share of it the moment the entry is saved. */
  tabId?: string | null;
  /** How much of the amount is being laid out for them. Absent means all of
      it, which is the ordinary case; less than the amount leaves the rest as
      genuinely yours, categorised and counted. */
  tabCoveredMinor?: number | null;
  /* Only on an entry that waited on the phone for signal. The reference makes
     a second delivery of the same entry harmless; the household id lets the
     server refuse an entry typed under one sign-in and sent under another. */
  clientRef?: string;
  householdId?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function checkDuplicate(amountMinor: number, occurredOn: string) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  const { household_id } = await currentActor();
  const hit = await possibleDuplicate(household_id, amountMinor, occurredOn);
  if (!hit) return null;
  return {
    amountMinor: Number(hit.amount),
    who: hit.who,
    merchant: hit.merchant,
    account: hit.account,
    on: new Date(hit.occurred_on).toISOString().slice(0, 10),
  };
}

export async function saveEntry(d: Draft): Promise<SaveResult> {
  const { household_id, user_id, role } = await currentActor();

  // A viewer can read the books and nothing else. Checked here rather than by
  // hiding the button, because this function is reachable by direct POST.
  if (role === 'viewer') {
    return { ok: false, error: 'Viewers cannot add entries.' };
  }

  if (!Number.isSafeInteger(d.amountMinor) || d.amountMinor <= 0) {
    return { ok: false, error: 'Enter an amount.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.occurredOn)) {
    return { ok: false, error: 'That date is not valid.' };
  }
  if (d.clientRef !== undefined && !UUID.test(d.clientRef)) {
    return { ok: false, error: 'That entry could not be read.' };
  }
  if (d.householdId !== undefined && d.householdId !== household_id) {
    return { ok: false, error: 'This entry was recorded under a different sign-in.' };
  }
  const clientRef = d.clientRef ?? null;
  if (clientRef) {
    // Already here from an earlier delivery: say so, and say which row.
    const [dup] = await sql`
      select id from txn where household_id = ${household_id} and client_ref = ${clientRef}`;
    if (dup) return { ok: true, id: dup.id };
  }

  // The method decides the account, so the client never names one. This is
  // also what keeps "paid by GPay" leaving the bank GPay draws on.
  const [method] = await sql`
    select id, funding_account_id from payment_method
    where id = ${d.methodId} and household_id = ${household_id} and archived_at is null`;
  if (!method) return { ok: false, error: 'That payment method is not one of yours.' };

  let categoryId: string | null = null;
  if (d.kind !== 'transfer') {
    if (!d.categoryId) return { ok: false, error: 'Choose a category.' };
    const [cat] = await sql`
      select id from category
      where id = ${d.categoryId} and household_id = ${household_id} and archived_at is null`;
    if (!cat) return { ok: false, error: 'That category is not one of yours.' };
    categoryId = cat.id;
  }

  /* A cost put on a tab is laid out for the people on it: their shares become
     loans into their own accounts, so it is never your spending and never
     reaches your budget. The tab is checked the way everything else is —
     this household's, still open, and with someone on it, because money laid
     out for nobody is not laid out. */
  let tab: { id: string; members: { id: string; account_id: string }[] } | null = null;
  let covered = 0;
  if (d.tabId) {
    if (d.kind !== 'expense') return { ok: false, error: 'Only a cost can be put on a tab.' };
    if (!UUID.test(d.tabId)) return { ok: false, error: 'That tab could not be read.' };
    const [b] = await sql`
      select id, closed_at from ledger_book
      where id = ${d.tabId} and household_id = ${household_id}`;
    if (!b) return { ok: false, error: 'That tab is not one of yours.' };
    if (b.closed_at) return { ok: false, error: 'That tab is closed. Reopen it under Lending first.' };
    const members = await sql`
      select cp.id, cp.account_id from book_member bm
      join counterparty cp on cp.id = bm.counterparty_id and cp.archived_at is null
      where bm.book_id = ${b.id} order by cp.id`;
    if (members.length === 0) return { ok: false, error: 'Nobody is on that tab yet.' };

    covered = d.tabCoveredMinor ?? d.amountMinor;
    if (!Number.isSafeInteger(covered) || covered <= 0) {
      return { ok: false, error: 'Enter how much of it comes back.' };
    }
    if (covered > d.amountMinor) {
      return { ok: false, error: 'That is more than the amount itself.' };
    }
    tab = { id: b.id, members: members.map((m) => ({ id: m.id, account_id: m.account_id })) };
  }

  let counter: string | null = null;
  if (d.kind === 'transfer') {
    if (!d.counterAccountId) return { ok: false, error: 'Choose where it is going.' };
    const [acc] = await sql`
      select id from real_account
      where id = ${d.counterAccountId} and household_id = ${household_id} and archived_at is null`;
    if (!acc) return { ok: false, error: 'That account is not one of yours.' };
    if (acc.id === method.funding_account_id) {
      return { ok: false, error: 'An account cannot transfer to itself.' };
    }
    counter = acc.id;
  }

  try {
    const row = await sql.begin(async (tx) => {
      const common = {
        household_id,
        created_by: user_id,
        currency: 'INR',
        occurred_on: d.occurredOn,
        payment_method_id: method.id,
        merchant: String(d.merchant ?? '').trim() || null,
        is_shared: d.isShared,
        source: 'manual' as const,
        book_id: tab?.id ?? null,
      };
      /* Nothing on a tab, and it is the one entry it looks like. */
      if (!tab) {
        const [only] = await tx`insert into txn ${sql({
          ...common,
          kind: d.kind,
          amount: d.amountMinor,
          account_id: method.funding_account_id,
          counter_account_id: counter,
          category_id: categoryId,
          client_ref: clientRef,
        })} on conflict (household_id, client_ref) where client_ref is not null do nothing
           returning id`;
        return only;
      }

      /* On a tab, one payment becomes several rows: what you bore, if any,
         and one loan per person for their share of what comes back. They
         carry the same group_ref, because they are one thing that happened
         and the ledger should say so. The first row written carries the
         offline reference, so a second delivery finds it and stops — the
         whole group landed with it or none of it did. */
      const { shares: each, mine } = breakdown(d.amountMinor, covered, tab.members.length);
      const groupRef = randomUUID();
      let first: { id: string } | undefined;
      if (mine > 0) {
        const [ours] = await tx`insert into txn ${sql({
          ...common,
          kind: 'expense',
          amount: mine,
          account_id: method.funding_account_id,
          category_id: categoryId,
          group_ref: groupRef,
          client_ref: clientRef,
        })} on conflict (household_id, client_ref) where client_ref is not null do nothing
           returning id`;
        if (!ours) return undefined;
        first = { id: ours.id as string };
      }

      for (let i = 0; i < tab.members.length; i++) {
        if (each[i] <= 0) continue;
        const [lent] = await tx`insert into txn ${sql({
          ...common,
          kind: 'transfer',
          amount: each[i],
          account_id: method.funding_account_id,
          counter_account_id: tab.members[i].account_id,
          category_id: categoryId,
          group_ref: groupRef,
          client_ref: first ? null : clientRef,
        })} on conflict (household_id, client_ref) where client_ref is not null do nothing
           returning id`;
        if (!lent && !first) return undefined;
        if (lent) first ??= { id: lent.id as string };
      }
      return first;
    });
    if (tab) { revalidatePath(`/tab/${tab.id}`); revalidatePath('/people'); revalidatePath('/worth'); }
    revalidatePath('/');
    if (row) return { ok: true, id: row.id };
    /* Lost the race with our own retry: the other delivery landed between
       the check above and this insert. The unique index kept it to one row;
       hand back that row. */
    const [won] = await sql`
      select id from txn where household_id = ${household_id} and client_ref = ${clientRef}`;
    return won ? { ok: true, id: won.id } : { ok: false, error: 'That could not be saved. Try again.' };
  } catch (e) {
    /* A constraint fired. Log what rule was broken, never the row — a
       Postgres error carries the offending values in `detail`, which here
       means amounts and merchant names. */
    const pg = e as { code?: string; constraint_name?: string };
    console.error('saveEntry refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
    return { ok: false, error: 'That could not be saved. Check the amount and try again.' };
  }
}
