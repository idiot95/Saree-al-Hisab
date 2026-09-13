'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { resolvePayment } from '@/db/payment';
import { fromKeys } from '@/lib/money';
import { rethrowControlFlow } from '@/lib/rethrow';
import { fits, misfit } from '@/lib/scope';

/** Where an edit may send you back to: a screen of ours, never a URL from the form. */
const BACK = /^\/(?:|entries|accounts|people|tab\/[0-9a-f-]{36}|people\/[0-9a-f-]{36})$/;

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const amount = (v: FormDataEntryValue | null) =>
  fromKeys(String(v ?? '').replace(/[^0-9.]/g, ''));

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot change entries.');
  return actor;
}

/* What an edit may touch: the amount, the date, the category, what it was
   called, and how it was paid. Not the KIND — turning an expense into a
   transfer changes which shape rules apply and which columns must be filled,
   and quietly rewriting a row into a different shape is how a ledger starts
   disagreeing with itself. Delete it and add it again instead. */
export async function updateEntry(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('id') ?? '');
    const [existing] = await sql`
      select t.id, t.kind, t.counts_as_spend, t.amount::bigint as amount,
             to_char(t.occurred_on, 'YYYY-MM-DD') as occurred_on, t.account_id,
             (t.book_id is not null or exists (select 1 from claim c where c.txn_id = t.id)) as owed
      from txn t
      where t.id = ${id} and t.household_id = ${actor.household_id} and t.deleted_at is null`;
    if (!existing) return { ok: false, error: 'That entry is not one of yours.' };

    /* "Was this my spending" can only be revisited on a cost somebody owes back
       for. On a plain expense the form never shows the question, and a direct
       POST does not get to answer it either: an expense nobody owes for that is
       also not yours would simply vanish from the month. */
    const counts = existing.kind === 'expense' && existing.owed
      ? fd.get('counts_as_spend') === 'on'
      : existing.counts_as_spend;

    const minor = amount(fd.get('amount'));
    if (!Number.isSafeInteger(minor) || minor <= 0) return { ok: false, error: 'Enter an amount.' };

    const occurredOn = String(fd.get('occurred_on') ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) return { ok: false, error: 'That date is not valid.' };

    const merchant = String(fd.get('merchant') ?? '').trim() || null;
    const note = String(fd.get('note') ?? '').trim() || null;
    const isShared = fd.get('is_shared') === 'on';

    // A move carries no category; everything else must have one.
    const wantsCategory = !['transfer', 'card_payment', 'claim_receipt', 'adjust_in', 'adjust_out'].includes(existing.kind);
    let categoryId: string | null = null;
    if (wantsCategory) {
      const raw = String(fd.get('category_id') ?? '');
      const [cat] = await sql`
        select id, name, scope from category
        where id = ${raw} and household_id = ${actor.household_id} and archived_at is null`;
      if (!cat) return { ok: false, error: 'Choose a category.' };
      if (!fits(cat.scope, existing.kind)) return { ok: false, error: misfit(existing.kind, cat.name) };
      categoryId = cat.id;
    }

    // How it was paid, when the form offers the choice. A rail decides its
    // account and an account paid from directly carries no rail; either way
    // the trigger re-files or clears the card cycle from the account written.
    const rawPaid = String(fd.get('paid_with') ?? '');
    let paid: { account_id: string; payment_method_id: string | null } | null = null;
    if (rawPaid) {
      paid = await resolvePayment(actor.household_id, rawPaid);
      if (!paid) return { ok: false, error: 'That account is not one of yours.' };
    }

    /* What is owed for it follows the amount. Each share keeps its part of
       the whole — a cost split three ways stays split three ways, a cost only
       half owed back stays half — worked in paise with the odd paisa going to
       the largest remainders, so the shares still add up exactly. A share
       cannot fall below what that person has already paid back. */
    const oldAmount = Number(existing.amount);
    const reshared: { id: string; amount: number }[] = [];
    if (minor !== oldAmount) {
      const claims = await sql`
        select cs.id, cs.expected_amount::bigint as expected, cs.received::bigint as received
        from claim_state cs
        where cs.txn_id = ${id} and cs.household_id = ${actor.household_id} and cs.written_off_at is null
        order by cs.created_at, cs.id`;
      const total = claims.reduce((n, c) => n + Number(c.expected), 0);
      if (claims.length && total > 0) {
        const target = Math.min(minor, Math.round((total * minor) / oldAmount));
        const raw = claims.map((c) => (Number(c.expected) * target) / total);
        const each = raw.map(Math.floor);
        let left = target - each.reduce((n, v) => n + v, 0);
        [...raw.keys()].sort((a, b) => (raw[b] - each[b]) - (raw[a] - each[a]))
          .forEach((k) => { if (left > 0) { each[k] += 1; left -= 1; } });
        for (let k = 0; k < claims.length; k++) {
          if (each[k] <= 0) return { ok: false, error: 'That is too small to split between the people who owe for it.' };
          if (each[k] < Number(claims[k].received)) {
            return { ok: false, error: 'Someone has already paid back more than their share of the new amount. Record the difference as money back instead.' };
          }
          reshared.push({ id: claims[k].id as string, amount: each[k] });
        }
      }
    }
    /* Reconciled against a statement, the entry said what the bank said. A new
       amount, day or account no longer does, so it comes off that
       reconciliation; a new note or category does not change the figure. */
    const moved = minor !== oldAmount || occurredOn !== existing.occurred_on
      || (paid !== null && paid.account_id !== existing.account_id);

    try {
      await sql.begin(async (tx) => {
        await tx`
          update txn set amount = ${minor}, occurred_on = ${occurredOn}::date,
                         category_id = ${categoryId}, merchant = ${merchant}, note = ${note},
                         ${paid ? tx`account_id = ${paid.account_id}, payment_method_id = ${paid.payment_method_id},` : tx``}
                         ${moved ? tx`reconciled_id = null, counter_reconciled_id = null,` : tx``}
                         is_shared = ${isShared}, counts_as_spend = ${counts}
          where id = ${id} and household_id = ${actor.household_id}`;
        for (const r of reshared) {
          await tx`update claim set expected_amount = ${r.amount}
                   where id = ${r.id} and household_id = ${actor.household_id}`;
        }
      });
    } catch (e) {
      const pg = e as { code?: string; constraint_name?: string };
      console.error('updateEntry refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
      return { ok: false, error: 'That change could not be saved.' };
    }

    revalidatePath('/entries');
    revalidatePath('/');
    revalidatePath('/accounts');
    revalidatePath('/people');
    const back = String(fd.get('back') ?? '');
    if (back.startsWith('/tab/')) revalidatePath(back);
    redirect(BACK.test(back) ? back : '/entries');
  });
}

/* Marked deleted, never removed. Every view already filters on deleted_at, so
   the figures move immediately — but the row is still there if the household
   ever has to work out what happened. */
export async function deleteEntry(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {

    const id = String(fd.get('id') ?? '');
    const done = await sql`
      update txn set deleted_at = now()
      where id = ${id} and household_id = ${actor.household_id} and deleted_at is null
      returning id`;
    if (!done.length) return { ok: false, error: 'That entry is not one of yours.' };

    revalidatePath('/entries');
    revalidatePath('/');
    revalidatePath('/accounts');
    redirect('/entries');
  });
}

/* The same soft delete, for a swipe in the list. No redirect — the list is
   already on screen and the row has already gone from it — and no dialog,
   because the safeguard is a better one: Undo. */
export async function removeEntry(id: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) {
      return { ok: false, error: 'That entry could not be read.' };
    }
    const done = await sql`
      update txn set deleted_at = now()
      where id = ${id} and household_id = ${actor.household_id} and deleted_at is null
      returning id`;
    if (!done.length) return { ok: false, error: 'That entry is not one of yours.' };
    revalidatePath('/entries');
    revalidatePath('/');
    revalidatePath('/accounts');
    return { ok: true };
  });
}

/* Undo, and only undo: a row this household deleted in the last quarter of an
   hour. Anything older stays where the ledger put it — this is the safety net
   under a swipe, not a way to resurrect history. */
export async function restoreEntry(id: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) {
      return { ok: false, error: 'That entry could not be read.' };
    }
    const done = await sql`
      update txn set deleted_at = null
      where id = ${id} and household_id = ${actor.household_id}
        and deleted_at is not null and deleted_at > now() - interval '15 minutes'
      returning id`;
    if (!done.length) return { ok: false, error: 'That entry could not be brought back.' };
    revalidatePath('/entries');
    revalidatePath('/');
    revalidatePath('/accounts');
    return { ok: true };
  });
}

/* Bills added after the entry exists — the moment right after a cost is saved
   on a tab, or any time later from a swipe. The same ceilings as saveEntry:
   five to an entry, two megabytes each, images and PDFs only, checked here
   because the client is not a gatekeeper. The entry is checked to be this
   household's and not deleted before a byte is written. */
const BILL_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const BILLS_PER_ENTRY = 5;
const BILL_BYTES = 2 * 1024 * 1024;

export async function addBills(txnId: unknown, files: unknown): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    if (typeof txnId !== 'string' || !/^[0-9a-f-]{36}$/.test(txnId)) {
      return { ok: false, error: 'That entry could not be read.' };
    }
    if (!Array.isArray(files) || files.length === 0) return { ok: false, error: 'Choose a bill to attach.' };
    const [t] = await sql`
      select t.id, t.book_id, (select count(*)::int from attachment a where a.txn_id = t.id) as bills
      from txn t
      where t.id = ${txnId} and t.household_id = ${actor.household_id} and t.deleted_at is null`;
    if (!t) return { ok: false, error: 'That entry is not one of yours.' };
    const room = BILLS_PER_ENTRY - Number(t.bills);
    if (room <= 0) return { ok: false, error: 'An entry keeps five bills at most.' };

    const good: { name: string; mime: string; buf: Buffer }[] = [];
    for (const f of files.slice(0, room)) {
      const { name, mime, data } = (f ?? {}) as { name?: unknown; mime?: unknown; data?: unknown };
      if (typeof mime !== 'string' || !BILL_MIME.has(mime) || typeof data !== 'string') continue;
      const buf = Buffer.from(data, 'base64');
      if (buf.length === 0 || buf.length > BILL_BYTES) continue;
      good.push({ name: String(name ?? '').slice(0, 120) || 'Bill', mime, buf });
    }
    if (good.length === 0) return { ok: false, error: 'That file could not be attached — images and PDFs under 2 MB.' };

    await sql.begin(async (tx) => {
      for (const g of good) {
        await tx`
          insert into attachment (household_id, txn_id, name, mime, bytes, data, created_by)
          values (${actor.household_id}, ${t.id}, ${g.name}, ${g.mime}, ${g.buf.length}, ${g.buf}, ${actor.user_id})`;
      }
    });
    revalidatePath(`/entries/${t.id}`);
    if (t.book_id) revalidatePath(`/tab/${t.book_id}`);
    return { ok: true, message: good.length === 1 ? 'Bill attached.' : `${good.length} bills attached.` };
  });
}
