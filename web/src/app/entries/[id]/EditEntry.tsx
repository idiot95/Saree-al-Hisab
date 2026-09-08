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

export default function EditEntry({ entry, categories, ways, canEdit }: {
  entry: {
    id: string; kind: string; amount: string; occurred_on: string;
    merchant: string | null; note: string | null; is_shared: boolean;
    category_id: string | null; account_id: string; payment_method_id: string | null;
    counts_as_spend: boolean;
    /** Somebody owes for it — on a tab, or with a claim — so "was it mine" is a live question. */
    owed: boolean;
  };
  categories: Category[]; ways: Way[]; canEdit: boolean;
}) {
  const { format, toKeys, fromKeys } = useMoney();
  const [state, act, pending] = useActionState(updateEntry, null);
  const [del, remove, removing] = useActionState(deleteEntry, null);
  const [amount, setAmount] = useState(toKeys(Number(entry.amount)));
  const [categoryId, setCategoryId] = useState(entry.category_id ?? '');
  const [confirming, setConfirming] = useState(false);

  const wantsCategory = !['transfer', 'card_payment', 'claim_receipt'].includes(entry.kind);
  // An entry keeps its kind, so the list is the categories that file it.
  const offered = categories.filter((c) => fits(c.scope, entry.kind));
  const minor = fromKeys(amount.replace(/[^0-9.]/g, ''));

  return (
    <>
      <form action={act} className="el card" style={{
        margin: '0 var(--gutter) 16px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <input type="hidden" name="id" value={entry.id} />

        {/* The amount is what people come here to fix, so it is the biggest
            thing on the screen and already focused. */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Amount</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 62, padding: '0 14px',
            borderRadius: 14, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
          }}>
            <span className="t" style={{ fontSize: 'var(--step-3)', color: 'var(--c-meta)' }}>₹</span>
            <input
              name="amount" inputMode="decimal" value={amount} disabled={!canEdit}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="t"
              style={{
                flex: 1, minHeight: 58, border: 0, background: 'transparent',
                color: 'var(--c-ink)', fontSize: 'var(--step-4)', letterSpacing: '-.02em', width: '100%',
              }}
            />
          </span>
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{format(minor)}</span>
        </label>

        <Field label="Date" name="occurred_on" type="date"
          defaultValue={entry.occurred_on} disabled={!canEdit} required />

        {wantsCategory && (
          <>
            <input type="hidden" name="category_id" value={categoryId} />
            <CategoryPick categories={offered} value={categoryId} onChange={setCategoryId}
              disabled={!canEdit} label={entry.kind === 'income' ? 'What for' : 'Category'} />
          </>
        )}

        {ways.length > 0 && (
          <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
              {entry.kind === 'income' ? 'How it came in' : entry.kind === 'transfer' ? 'From which account' : 'How you paid'}
            </span>
            <PayPicker name="paid_with" ways={ways}
              defaultValue={entry.payment_method_id ? railRef(entry.payment_method_id) : accountRef(entry.account_id)}
              disabled={!canEdit} />
            <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
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
              style={{ width: 20, height: 20, marginTop: 2, flex: 'none', accentColor: 'var(--c-seagrass)' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Counts as my spending</span>
              <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
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
            style={{ width: 20, height: 20, accentColor: 'var(--c-seagrass)' }} />
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>Shared with the household</span>
        </label>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        {canEdit && (
          <button type="submit" disabled={pending} className="el2 cta" style={{
            minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600, color: '#fff',
            opacity: pending ? 0.6 : 1,
            background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
              + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
          }}>{pending ? 'Saving…' : 'Save changes'}</button>
        )}
      </form>

      {canEdit && (
        <div style={{ margin: '0 var(--gutter)' }}>
          {!confirming ? (
            <button className="cta" type="button" onClick={() => setConfirming(true)} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'transparent', color: 'var(--c-danger)',
            }}>Delete this entry</button>
          ) : (
            <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="id" value={entry.id} />
              <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
                The month&rsquo;s totals and the account balance change straight away.
              </p>
              {del && !del.ok && <ErrorNote>{del.error}</ErrorNote>}
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="cta" type="button" onClick={() => setConfirming(false)} style={{
                  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)',
                  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
                }}>Cancel</button>
                <button className="cta" type="submit" disabled={removing} style={{
                  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
                  background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
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
