'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { format } from '@/lib/money';
import { rethrowControlFlow } from '@/lib/rethrow';

export type Result = { ok: true; message?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mustWrite() {
  const actor = await currentActor();
  if (actor.role === 'viewer') throw new Error('Viewers cannot reconcile accounts.');
  return actor;
}

const SIGNED = (acc: string) => sql`case
  when t.account_id = ${acc} and t.kind in ('expense','transfer','card_payment','adjust_out') then -t.amount
  when t.account_id = ${acc} and t.kind in ('income','claim_receipt','refund','adjust_in') then t.amount
  when t.counter_account_id = ${acc} then t.amount
  else 0 end`;

/* Matching an account to its statement.

   Everything is worked out again here, from the database, whatever the screen
   said: the balance already ticked off, which of the ticked entries are
   really this account's and still unmatched, and whether they reach the
   statement. A finished reconciliation always balances to the paisa — either
   the ticks add up, or the person has asked for the difference to be recorded
   as one adjustment entry, dated on the statement and ticked off with the
   rest. An adjustment is neither spending nor income (spend_txn and
   income_txn select other kinds); it is only what the books were missing. */
export async function finishReconcile(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const acc = String(fd.get('accountId') ?? '');
    const on = String(fd.get('on') ?? '');
    const raw = String(fd.get('balance') ?? '');
    const ticked = [...new Set(fd.getAll('txnId').map(String).filter((id) => UUID.test(id)))];
    const adjust = fd.get('adjust') === 'yes';

    if (!UUID.test(acc)) return { ok: false, error: 'That account could not be read.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(on)) return { ok: false, error: 'Choose the statement date.' };
    if (!/^-?\d{1,15}$/.test(raw)) return { ok: false, error: 'Enter the balance on the statement.' };
    const statement = Number(raw);

    const [account] = await sql`
      select a.id, a.name, a.opening_balance::bigint as opening, a.kind from account a
      where a.id = ${acc} and a.household_id = ${actor.household_id}
        and a.archived_at is null and a.kind <> 'person'`;
    if (!account) return { ok: false, error: 'That account is not one of yours.' };

    const [{ today, last }] = await sql`
      select to_char(current_date, 'YYYY-MM-DD') as today,
             (select to_char(max(statement_on), 'YYYY-MM-DD') from reconciliation where account_id = ${acc}) as last`;
    if (on > today) return { ok: false, error: 'A statement cannot be dated after today.' };
    if (last && on < last) {
      return { ok: false, error: 'That is before the last statement you matched. Undo that one first.' };
    }

    const [{ cleared }] = await sql`
      select (${Number(account.opening)}::bigint + coalesce(sum(${SIGNED(acc)}), 0))::bigint as cleared
      from txn t
      where t.household_id = ${actor.household_id} and t.deleted_at is null
        and ((t.account_id = ${acc} and t.reconciled_id is not null)
             or (t.counter_account_id = ${acc} and t.counter_reconciled_id is not null))`;

    const rows = ticked.length ? await sql`
      select t.id, (t.account_id = ${acc}) as own_side, (${SIGNED(acc)})::bigint as signed,
             to_char(t.occurred_on, 'YYYY-MM-DD') as on
      from txn t
      where t.household_id = ${actor.household_id} and t.deleted_at is null
        and t.id = any(${ticked}::uuid[])
        and ((t.account_id = ${acc} and t.reconciled_id is null)
             or (t.counter_account_id = ${acc} and t.counter_reconciled_id is null))` : [];
    if (rows.length !== ticked.length) {
      return { ok: false, error: 'One of those entries has changed or is already matched. Reload and try again.' };
    }
    if (rows.some((r) => String(r.on) > on)) {
      return { ok: false, error: 'An entry ticked is dated after the statement. Untick it, or move the statement date.' };
    }

    const reached = Number(cleared) + rows.reduce((n, r) => n + Number(r.signed), 0);
    const difference = statement - reached;
    if (difference !== 0 && !adjust) {
      return { ok: false, error: `It is off by ${format(Math.abs(difference))}. Untick what the statement does not show, add what is missing, or record the difference.` };
    }

    let id = '';
    try {
      await sql.begin(async (tx) => {
        const [rec] = await tx`
          insert into reconciliation (household_id, account_id, statement_on, statement_balance, created_by)
          values (${actor.household_id}, ${acc}, ${on}::date, ${statement}, ${actor.user_id}) returning id`;
        id = rec.id;
        if (difference !== 0) {
          const day = new Date(`${on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const [adj] = await tx`
            insert into txn (household_id, created_by, kind, amount, occurred_on, account_id,
                             merchant, note, source, reconciled_id)
            values (${actor.household_id}, ${actor.user_id},
                    ${difference > 0 ? 'adjust_in' : 'adjust_out'}, ${Math.abs(difference)}, ${on}::date, ${acc},
                    'Balance adjustment', ${`From matching the ${day} statement`}, 'manual', ${rec.id})
            returning id`;
          await tx`update reconciliation set adjustment_txn_id = ${adj.id} where id = ${rec.id}`;
        }
        const own = rows.filter((r) => r.own_side).map((r) => r.id as string);
        const other = rows.filter((r) => !r.own_side).map((r) => r.id as string);
        if (own.length) await tx`update txn set reconciled_id = ${rec.id} where id = any(${own}::uuid[])`;
        if (other.length) await tx`update txn set counter_reconciled_id = ${rec.id} where id = any(${other}::uuid[])`;
      });
    } catch (e) {
      const pg = e as { code?: string; constraint_name?: string };
      console.error('finishReconcile refused:', pg.code ?? 'unknown', pg.constraint_name ?? '');
      return { ok: false, error: 'That could not be saved. Try again.' };
    }

    revalidatePath('/accounts');
    revalidatePath('/accounts/reconcile');
    revalidatePath('/entries');
    revalidatePath('/worth');
    revalidatePath('/');
    redirect(`/accounts/${acc}/reconcile?done=${id}`);
  });
}

/* Taking back the most recent match on an account: its ticks come off and its
   adjustment, if it made one, is deleted the way any entry is. Only the latest,
   because an older one is what the newer ones were built on. */
export async function undoReconcile(_prev: Result | null, fd: FormData): Promise<Result> {
  let actor;
  try { actor = await mustWrite(); }
  catch (e) { rethrowControlFlow(e); return { ok: false, error: (e as Error).message }; }
  return withHousehold(actor.household_id, async () => {
    const id = String(fd.get('id') ?? '');
    if (!UUID.test(id)) return { ok: false, error: 'That could not be read.' };
    const [rec] = await sql`
      select r.id, r.account_id, r.adjustment_txn_id,
             r.id = (select r2.id from reconciliation r2 where r2.account_id = r.account_id
                     order by r2.statement_on desc, r2.created_at desc limit 1) as latest
      from reconciliation r
      where r.id = ${id} and r.household_id = ${actor.household_id}`;
    if (!rec) return { ok: false, error: 'That is not one of yours.' };
    if (!rec.latest) return { ok: false, error: 'Only the latest statement can be undone.' };

    await sql.begin(async (tx) => {
      await tx`update txn set reconciled_id = null where reconciled_id = ${id}`;
      await tx`update txn set counter_reconciled_id = null where counter_reconciled_id = ${id}`;
      if (rec.adjustment_txn_id) {
        await tx`update txn set deleted_at = now() where id = ${rec.adjustment_txn_id} and deleted_at is null`;
      }
      await tx`delete from reconciliation where id = ${id}`;
    });
    revalidatePath('/accounts');
    revalidatePath('/accounts/reconcile');
    revalidatePath('/entries');
    revalidatePath('/worth');
    revalidatePath('/');
    redirect(`/accounts/${rec.account_id}/reconcile`);
  });
}
