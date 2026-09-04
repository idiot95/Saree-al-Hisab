'use server';

import { revalidatePath } from 'next/cache';
import { sql } from '@/db/client';
import { currentActor, possibleDuplicate } from '@/db/queries';

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
};

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
    const [row] = await sql`insert into txn ${sql({
      household_id,
      created_by: user_id,
      kind: d.kind,
      amount: d.amountMinor,
      currency: 'INR',
      occurred_on: d.occurredOn,
      account_id: method.funding_account_id,
      counter_account_id: counter,
      category_id: categoryId,
      payment_method_id: method.id,
      merchant: d.merchant.trim() || null,
      is_shared: d.isShared,
      source: 'manual',
    })} returning id`;
    revalidatePath('/');
    return { ok: true, id: row.id };
  } catch (e) {
    /* A constraint fired. Log what rule was broken, never the row — a
       Postgres error carries the offending values in `detail`, which here
       means amounts and merchant names. */
    const pg = e as { code?: string; constraint_name?: string };
    console.error('saveEntry refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
    return { ok: false, error: 'That could not be saved. Check the amount and try again.' };
  }
}
