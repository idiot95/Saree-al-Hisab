'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor, possibleDuplicate } from '@/db/queries';
import { shares } from '../tab/splits';

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
  /** How much of the amount comes back. Absent means all of it, which is the
      ordinary case; less leaves the rest owed by nobody. */
  tabCoveredMinor?: number | null;
  /** Whether this was money you bore. Asked of every cost on a tab and
      independent of what comes back: petrol burnt for work is your spending
      and reimbursed; rent fronted for a cousin is neither. Absent — only an
      entry queued by an older build — is taken as yours, the safer error,
      because a cost that shows in the month gets noticed and a cost that
      vanishes from it does not. */
  countsAsSpend?: boolean | null;
  /** On an income: the open claims this money clears. Each gets a receipt
      for what it is owed, oldest first, and only what is left over — if
      anything — is recorded as earning. */
  settles?: string[];
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

  /* Money arriving against what people owe. The claims are checked to be this
     household's and still open; the amount is spread across them oldest first;
     and whatever is left over is the only part that is income. */
  let settles: { id: string; outstanding: number }[] = [];
  let leftover = d.amountMinor;
  if (d.settles?.length) {
    if (d.kind !== 'income') return { ok: false, error: 'Only money coming in can settle what is owed.' };
    if (d.settles.length > 50 || d.settles.some((id) => !UUID.test(id))) {
      return { ok: false, error: 'Those entries could not be read.' };
    }
    const open = await sql`
      select cs.id, cs.outstanding::bigint
      from claim_state cs join txn t on t.id = cs.txn_id and t.deleted_at is null
      where cs.household_id = ${household_id} and cs.id = any(${d.settles}::uuid[])
        and cs.status in ('open', 'part_paid')
      order by t.occurred_on, t.created_at`;
    if (open.length !== new Set(d.settles).size) {
      return { ok: false, error: 'One of those is already settled. Reload and try again.' };
    }
    settles = open.map((c) => ({ id: c.id as string, outstanding: Number(c.outstanding) }));
    leftover = Math.max(0, d.amountMinor - settles.reduce((n, c) => n + c.outstanding, 0));
  }

  let categoryId: string | null = null;
  if (d.kind !== 'transfer' && !(settles.length && leftover === 0)) {
    if (!d.categoryId) {
      return { ok: false, error: settles.length ? 'Choose a category for the part that is income.' : 'Choose a category.' };
    }
    const [cat] = await sql`
      select id from category
      where id = ${d.categoryId} and household_id = ${household_id} and archived_at is null`;
    if (!cat) return { ok: false, error: 'That category is not one of yours.' };
    categoryId = cat.id;
  }

  /* A cost put on a tab raises one claim per person on it for their share of
     what comes back. The tab is checked the way everything else is — this
     household's, still open, and with someone on it, because a cost owed back
     by nobody is not owed back. */
  let tab: { id: string; members: string[] } | null = null;
  let covered = 0;
  let counts = true;
  if (d.tabId) {
    if (d.kind !== 'expense') return { ok: false, error: 'Only a cost can be put on a tab.' };
    if (!UUID.test(d.tabId)) return { ok: false, error: 'That tab could not be read.' };
    const [b] = await sql`
      select id, closed_at from ledger_book
      where id = ${d.tabId} and household_id = ${household_id}`;
    if (!b) return { ok: false, error: 'That tab is not one of yours.' };
    if (b.closed_at) return { ok: false, error: 'That tab is closed. Reopen it under Lending first.' };
    const members = await sql`
      select cp.id from book_member bm
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
    counts = d.countsAsSpend ?? true;
    tab = { id: b.id, members: members.map((m) => m.id as string) };
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
      if (settles.length) {
        /* Receipts first, one per claim, until the money runs out; then the
           remainder as income. All of it in one transaction, and the client
           reference on the first row written, so a retry of the same delivery
           finds it and stops. */
        let left = d.amountMinor;
        let first: string | null = null;
        for (const c of settles) {
          if (left <= 0) break;
          const part = Math.min(left, c.outstanding);
          const ref = first ? null : clientRef;
          const [r] = await tx`insert into txn ${sql({
            household_id, created_by: user_id, kind: 'claim_receipt', amount: part,
            occurred_on: d.occurredOn, account_id: method.funding_account_id,
            payment_method_id: method.id, claim_id: c.id, source: 'manual', client_ref: ref,
          })} on conflict (household_id, client_ref) where client_ref is not null do nothing
             returning id`;
          if (!r) return null;
          first ??= r.id as string;
          left -= part;
        }
        if (left > 0) {
          const [r] = await tx`insert into txn ${sql({
            household_id, created_by: user_id, kind: 'income', amount: left,
            occurred_on: d.occurredOn, account_id: method.funding_account_id,
            category_id: categoryId, payment_method_id: method.id,
            merchant: String(d.merchant ?? '').trim() || null, is_shared: d.isShared, source: 'manual',
          })} returning id`;
          first ??= r.id as string;
        }
        return first ? { id: first } : null;
      }
      const [entry] = await tx`insert into txn ${sql({
        household_id,
        created_by: user_id,
        kind: d.kind,
        amount: d.amountMinor,
        occurred_on: d.occurredOn,
        account_id: method.funding_account_id,
        counter_account_id: counter,
        category_id: categoryId,
        payment_method_id: method.id,
        merchant: String(d.merchant ?? '').trim() || null,
        is_shared: d.isShared,
        source: 'manual',
        client_ref: clientRef,
        book_id: tab?.id ?? null,
        counts_as_spend: counts,
      })} on conflict (household_id, client_ref) where client_ref is not null do nothing
         returning id`;
      /* The entry and the shares land together or not at all: a cost on a tab
         with nobody down as owing for it would be a split that never happened.
         A share of zero paise is nothing owed and is not written. */
      if (entry && tab) {
        const each = shares(covered, tab.members.length);
        for (let i = 0; i < tab.members.length; i++) {
          if (each[i] <= 0) continue;
          await tx`
            insert into claim (household_id, counterparty_id, txn_id, kind, expected_amount)
            values (${household_id}, ${tab.members[i]}, ${entry.id}, 'reimbursement', ${each[i]})`;
        }
      }
      return entry;
    });
    if (tab) { revalidatePath(`/tab/${tab.id}`); revalidatePath('/people'); revalidatePath('/worth'); }
    if (settles.length) { revalidatePath('/people'); revalidatePath('/worth'); revalidatePath('/entries'); }
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
