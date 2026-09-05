'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { updateEntry, deleteEntry } from '../actions';
import { format } from '@/lib/money';

type Cat = { category_id: string; name: string; tint: string };
type Method = { id: string; name: string; funds: string };

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
};

export default function EditEntry({ entry, categories, methods, canEdit }: {
  entry: {
    id: string; kind: string; amount: string; occurred_on: string;
    merchant: string | null; note: string | null; is_shared: boolean;
    category_id: string | null; payment_method_id: string | null;
  };
  categories: Cat[]; methods: Method[]; canEdit: boolean;
}) {
  const [state, act, pending] = useActionState(updateEntry, null);
  const [del, remove, removing] = useActionState(deleteEntry, null);
  const [amount, setAmount] = useState(String(Number(entry.amount) / 100));
  const [categoryId, setCategoryId] = useState(entry.category_id ?? '');
  const [confirming, setConfirming] = useState(false);

  const wantsCategory = !['transfer', 'card_payment', 'claim_receipt'].includes(entry.kind);
  const minor = Math.round((Number(amount) || 0) * 100);

  return (
    <>
      <form action={act} className="el" style={{
        margin: '0 18px 16px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <input type="hidden" name="id" value={entry.id} />

        {/* The amount is what people come here to fix, so it is the biggest
            thing on the screen and already focused. */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>Amount</span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 62, padding: '0 14px',
            borderRadius: 14, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
          }}>
            <span className="t" style={{ fontSize: 24, color: 'var(--c-meta)' }}>₹</span>
            <input
              name="amount" inputMode="decimal" value={amount} disabled={!canEdit}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              className="t"
              style={{
                flex: 1, minHeight: 58, border: 0, background: 'transparent',
                color: 'var(--c-ink)', fontSize: 30, letterSpacing: '-.02em', width: '100%',
              }}
            />
          </span>
          <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>{format(minor)}</span>
        </label>

        <Field label="Date" name="occurred_on" type="date"
          defaultValue={entry.occurred_on} disabled={!canEdit} required />

        {wantsCategory && (
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
              Category
            </legend>
            <input type="hidden" name="category_id" value={categoryId} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {categories.map((c) => {
                const on = c.category_id === categoryId;
                const [bg, ink] = TINT[c.tint] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
                return (
                  <button key={c.category_id} type="button" disabled={!canEdit}
                    onClick={() => setCategoryId(c.category_id)}
                    style={{
                      minHeight: 44, padding: '0 14px', borderRadius: 999, fontSize: 14,
                      fontWeight: 600, background: on ? bg : 'var(--c-sunk2)',
                      color: on ? ink : 'var(--c-meta)',
                      border: `1px solid ${on ? ink : 'var(--c-border)'}`,
                    }}>{c.name}</button>
                );
              })}
            </div>
          </fieldset>
        )}

        {methods.length > 0 && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>Paid with</span>
            <select name="payment_method_id" defaultValue={entry.payment_method_id ?? ''}
              disabled={!canEdit} style={{
                minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
                background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 15.5,
                fontWeight: 600, padding: '0 12px',
              }}>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>{m.name} — {m.funds}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--c-meta)' }}>
              Changing this moves the money to the account behind it.
            </span>
          </label>
        )}

        <Field label="Merchant" name="merchant" defaultValue={entry.merchant ?? ''}
          disabled={!canEdit} maxLength={80} placeholder="Where it went" />
        <Field label="Note" name="note" defaultValue={entry.note ?? ''}
          disabled={!canEdit} maxLength={200} placeholder="Anything worth remembering" />

        <label style={{
          display: 'flex', alignItems: 'center', gap: 11, minHeight: 48, padding: '0 2px',
        }}>
          <input type="checkbox" name="is_shared" defaultChecked={entry.is_shared}
            disabled={!canEdit}
            style={{ width: 20, height: 20, accentColor: 'var(--c-seagrass)' }} />
          <span style={{ fontSize: 14.5, fontWeight: 600 }}>Shared with the household</span>
        </label>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

        {canEdit && (
          <button type="submit" disabled={pending} className="el2" style={{
            minHeight: 54, borderRadius: 15, fontSize: 16, fontWeight: 600, color: '#fff',
            opacity: pending ? 0.6 : 1,
            background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
              + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
          }}>{pending ? 'Saving…' : 'Save changes'}</button>
        )}
      </form>

      {canEdit && (
        <div style={{ margin: '0 18px' }}>
          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} style={{
              width: '100%', minHeight: 50, borderRadius: 13, fontSize: 14.5, fontWeight: 600,
              background: 'transparent', color: 'var(--c-danger)',
            }}>Delete this entry</button>
          ) : (
            <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="hidden" name="id" value={entry.id} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-meta)' }}>
                The month&rsquo;s totals and the account balance change straight away.
              </p>
              {del && !del.ok && <ErrorNote>{del.error}</ErrorNote>}
              <div style={{ display: 'flex', gap: 9 }}>
                <button type="button" onClick={() => setConfirming(false)} style={{
                  minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5,
                  fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
                }}>Cancel</button>
                <button type="submit" disabled={removing} style={{
                  flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15, fontWeight: 600,
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
