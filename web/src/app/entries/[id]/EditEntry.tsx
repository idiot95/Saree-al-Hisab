'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { Icon } from '@/app/Icon';
import { Info, danger, fieldLabel, formCard, ghost } from '@/app/form-bits';
import { updateEntry, deleteEntry } from '../actions';
import { useMoney } from '@/app/currency';
import PayPicker from '@/app/PayPicker';
import CategoryPick from '@/app/CategoryPick';
import type { Category } from '@/app/CategoryFinder';
import { accountRef, railRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';
import { DateChips } from '@/app/DatePick';
import { useKeepOnRefusal } from '@/app/form-hooks';

export default function EditEntry({ entry, categories, ways, canEdit, back = '/entries' }: {
  entry: {
    id: string; kind: string; amount: string; occurred_on: string;
    merchant: string | null; note: string | null; is_shared: boolean;
    category_id: string | null; account_id: string; payment_method_id: string | null;
    counts_as_spend: boolean;
    /** Somebody owes for it — on a tab, or with a claim — so "was it mine" is a live question. */
    owed: boolean;
    /** The statement this entry was ticked off against, if any. */
    reconciled_on?: string | null;
  };
  categories: Category[]; ways: Way[]; canEdit: boolean; back?: string;
}) {
  const { symbol, toKeys, keysDisplay } = useMoney();
  const [state, act, pending] = useActionState(updateEntry, null);
  // A page-level form: it posts directly, and a refusal's reset (which would undo the two ticks) is undone.
  const keep = useKeepOnRefusal(state);
  const [del, remove, removing] = useActionState(deleteEntry, null);
  const [amount, setAmount] = useState(toKeys(Number(entry.amount)));
  const [categoryId, setCategoryId] = useState(entry.category_id ?? '');
  const [on, setOn] = useState(entry.occurred_on);
  // The phone's own today, the same way Add Entry reckons it.
  const [today] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [confirming, setConfirming] = useState(false);

  const wantsCategory = !['transfer', 'card_payment', 'claim_receipt', 'adjust_in', 'adjust_out'].includes(entry.kind);
  // An entry keeps its kind, so the list is the categories that file it.
  const offered = categories.filter((c) => fits(c.scope, entry.kind));

  return (
    <>
      <form action={act} {...keep} className={`mx-[var(--gutter)] mb-4 ${formCard}`}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="back" value={back} />

        {/* The amount is what people come here to fix, so it is the biggest
            thing on the screen and already focused. */}
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Amount</span>
          <span className="flex min-h-[62px] items-center gap-1.5 rounded-xl border border-input bg-card px-3.5">
            <span className="text-[26px] text-muted-foreground">{symbol}</span>
            {/* Grouped as it is typed, the way Add Entry does it: one figure, not a raw one with a caption under it. */}
            <input
              name="amount" inputMode="decimal" value={keysDisplay(amount)} disabled={!canEdit}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="min-h-[58px] w-full flex-1 border-0 bg-transparent text-[30px] font-semibold tracking-tight tabular-nums text-foreground outline-none"
            />
          </span>
        </label>

        <div role="group" aria-label="When" className="flex flex-col gap-1.5">
          <span className={fieldLabel}>When</span>
          <input type="hidden" name="occurred_on" value={on} />
          {canEdit
            ? <DateChips value={on} onChange={setOn} today={today} dir="past" max={today} label="Which day was it" />
            : <span className="text-base">{on}</span>}
        </div>

        {wantsCategory && (
          <>
            <input type="hidden" name="category_id" value={categoryId} />
            <CategoryPick categories={offered} value={categoryId} onChange={setCategoryId}
              disabled={!canEdit} label={entry.kind === 'income' ? 'What for' : 'Category'} />
          </>
        )}

        {ways.length > 0 && (
          <div role="group" className="flex flex-col gap-1.5">
            <span className={fieldLabel}>
              {entry.kind === 'income' ? 'How it came in' : entry.kind === 'transfer' ? 'From which account' : 'How you paid'}
            </span>
            <PayPicker name="paid_with" ways={ways}
              defaultValue={entry.payment_method_id ? railRef(entry.payment_method_id) : accountRef(entry.account_id)}
              disabled={!canEdit} />
            <span className="text-xs leading-snug text-muted-foreground">
              Changing this moves the money to the account it names.
            </span>
          </div>
        )}

        <Field label="Merchant" name="merchant" defaultValue={entry.merchant ?? ''}
          disabled={!canEdit} maxLength={80} placeholder="Where it went" />
        <Field label="Note" name="note" defaultValue={entry.note ?? ''}
          disabled={!canEdit} maxLength={200} placeholder="Anything worth remembering" />

        {entry.owed && (
          <label className="flex min-h-12 items-start gap-3 px-0.5">
            <input type="checkbox" name="counts_as_spend" defaultChecked={entry.counts_as_spend}
              disabled={!canEdit} className="mt-0.5 size-5 flex-none accent-primary" />
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Counts as my spending</span>
              <span className="text-xs leading-snug text-muted-foreground">
                Ticked, it sits in the month and the charts even though it comes back. Unticked,
                it was never yours — money fronted, owed back, counted nowhere.
              </span>
            </span>
          </label>
        )}

        <label className="flex min-h-12 items-center gap-3 px-0.5">
          <input type="checkbox" name="is_shared" defaultChecked={entry.is_shared}
            disabled={!canEdit} className="size-5 flex-none accent-primary" />
          <span className="text-[15px] font-semibold">Shared with the household</span>
        </label>

        {entry.reconciled_on && (
          <Info>
            Reconciled against the {new Date(`${entry.reconciled_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} statement.
            Changing the amount, date or account takes it off that reconciliation.
          </Info>
        )}

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        {canEdit && (
          <button type="submit" disabled={pending} className={primaryBtn}>{pending ? 'Saving…' : 'Save changes'}</button>
        )}
      </form>

      {canEdit && (
        <div className="mx-[var(--gutter)]">
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-destructive">
              <Icon name="delete" size={20} />Delete this entry
            </button>
          ) : (
            <form action={remove} className="flex flex-col gap-2.5">
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="back" value={back} />
              <p className="text-sm leading-normal text-muted-foreground">
                The month&rsquo;s totals and the account balance change straight away.
              </p>
              {del && !del.ok && <ErrorNote>{del.error}</ErrorNote>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirming(false)} className={ghost}>Cancel</button>
                <button type="submit" disabled={removing} className={`${danger} flex-1`}>
                  <Icon name="delete" size={20} />{removing ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
