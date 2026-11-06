'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { updateEntry, deleteEntry } from '../actions';
import { useMoney } from '@/app/currency';
import PayPicker from '@/app/PayPicker';
import CategoryPick from '@/app/CategoryPick';
import type { Category } from '@/app/CategoryFinder';
import { accountRef, railRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';
import { DateChips } from '@/app/DatePick';

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
      <form action={act} className="border border-border" style={{
        margin: '0 var(--gutter) 16px', background: 'var(--card)', borderRadius: 18, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="back" value={back} />

        {/* The amount is what people come here to fix, so it is the biggest
            thing on the screen and already focused. */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>Amount</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 62, padding: '0 14px',
            borderRadius: 14, background: 'var(--background)', border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 26, color: 'var(--muted-foreground)' }}>{symbol}</span>
            {/* Grouped as it is typed, the way Add Entry does it: one figure, not a raw one with a caption under it. */}
            <input
              name="amount" inputMode="decimal" value={keysDisplay(amount)} disabled={!canEdit}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="t"
              style={{
                flex: 1, minHeight: 58, border: 0, background: 'transparent',
                color: 'var(--foreground)', fontSize: 'var(--step-4)', letterSpacing: '-.02em', width: '100%',
              }}
            />
          </span>
        </label>

        <div role="group" aria-label="When" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>When</span>
          <input type="hidden" name="occurred_on" value={on} />
          {canEdit
            ? <DateChips value={on} onChange={setOn} today={today} dir="past" max={today} label="Which day was it" />
            : <span style={{ fontSize: 'var(--step-0)' }}>{on}</span>}
        </div>

        {wantsCategory && (
          <>
            <input type="hidden" name="category_id" value={categoryId} />
            <CategoryPick categories={offered} value={categoryId} onChange={setCategoryId}
              disabled={!canEdit} label={entry.kind === 'income' ? 'What for' : 'Category'} />
          </>
        )}

        {ways.length > 0 && (
          <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              {entry.kind === 'income' ? 'How it came in' : entry.kind === 'transfer' ? 'From which account' : 'How you paid'}
            </span>
            <PayPicker name="paid_with" ways={ways}
              defaultValue={entry.payment_method_id ? railRef(entry.payment_method_id) : accountRef(entry.account_id)}
              disabled={!canEdit} />
            <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--muted-foreground)' }}>
              Changing this moves the money to the account it names.
            </span>
          </div>
        )}

        <Field label="Merchant" name="merchant" defaultValue={entry.merchant ?? ''}
          disabled={!canEdit} maxLength={80} placeholder="Where it went" />
        <Field label="Note" name="note" defaultValue={entry.note ?? ''}
          disabled={!canEdit} maxLength={200} placeholder="Anything worth remembering" />

        {entry.owed && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 48, padding: '0 2px',
          }}>
            <input type="checkbox" name="counts_as_spend" defaultChecked={entry.counts_as_spend}
              disabled={!canEdit}
              style={{ width: 20, height: 20, marginTop: 2, flex: 'none', accentColor: 'var(--primary)' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Counts as my spending</span>
              <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--muted-foreground)' }}>
                Ticked, it sits in the month and the charts even though it comes back. Unticked,
                it was never yours — money fronted, owed back, counted nowhere.
              </span>
            </span>
          </label>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: 11, minHeight: 48, padding: '0 2px',
        }}>
          <input type="checkbox" name="is_shared" defaultChecked={entry.is_shared}
            disabled={!canEdit}
            style={{ width: 20, height: 20, accentColor: 'var(--primary)' }} />
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Shared with the household</span>
        </label>

        {entry.reconciled_on && (
          <p style={{
            margin: 0, padding: '11px 13px', borderRadius: 12, background: 'var(--accent)',
            color: 'var(--foreground)', fontSize: 'var(--step--1)', lineHeight: 1.5,
          }}>
            Reconciled against the {new Date(`${entry.reconciled_on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} statement.
            Changing the amount, date or account takes it off that reconciliation.
          </p>
        )}

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        {canEdit && (
          <button type="submit" disabled={pending} className="cta" style={{
            minHeight: 54, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
            background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: pending ? 0.6 : 1,
          }}>{pending ? 'Saving…' : 'Save changes'}</button>
        )}
      </form>

      {canEdit && (
        <div style={{ margin: '0 var(--gutter)' }}>
          {!confirming ? (
            <button className="cta" type="button" onClick={() => setConfirming(true)} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'transparent', color: 'var(--destructive)',
            }}>Delete this entry</button>
          ) : (
            <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="back" value={back} />
              <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
                The month&rsquo;s totals and the account balance change straight away.
              </p>
              {del && !del.ok && <ErrorNote>{del.error}</ErrorNote>}
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="cta" type="button" onClick={() => setConfirming(false)} style={{
                  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)',
                  fontWeight: 600, background: 'var(--muted)', color: 'var(--muted-foreground)',
                }}>Cancel</button>
                <button className="cta" type="submit" disabled={removing} style={{
                  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
                  background: 'color-mix(in srgb, var(--destructive) 12%, transparent)', color: 'var(--destructive)',
                  opacity: removing ? 0.6 : 1,
                }}>{removing ? 'Deleting…' : 'Delete'}</button>
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}
