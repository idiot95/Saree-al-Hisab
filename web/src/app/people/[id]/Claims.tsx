'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { settleClaim, abandonClaim } from '../actions';
import { format } from '@/lib/money';

type Claim = {
  id: string; txn_id: string; expected_amount: string; received: string;
  outstanding: string; status: string; note: string | null;
  merchant: string | null; category: string | null; occurred_on: string;
};
type Method = { id: string; name: string; funds: string };

export default function Claims({ claims, methods, canEdit }: {
  claims: Claim[]; methods: Method[]; canEdit: boolean;
}) {
  const [settling, setSettling] = useState<string | null>(null);
  const [state, act, pending] = useActionState(settleClaim, null);
  const [, drop] = useActionState(abandonClaim, null);
  const today = new Date().toISOString().slice(0, 10);

  if (claims.length === 0) return null;
  const live = claims.filter((c) => c.status === 'open' || c.status === 'part_paid');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
        <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600 }}>Owed for shared costs</h2>
        <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      </div>
      <p style={{ margin: '-4px 20px 12px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
        Things you paid for that they owe part of. Already counted in the month you bought
        them — this is only what is coming back.
      </p>

      <section className="el" style={{
        margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
      }}>
        {claims.map((c, i) => (
          <div key={c.id} style={{
            padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 10,
            borderBottom: i === claims.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href={`/entries/${c.txn_id}`} style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3,
                textDecoration: 'none', color: 'var(--c-ink)',
              }}>
                <span style={{
                  fontSize: 15, fontWeight: 600, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.merchant || c.category || 'Entry'}</span>
                <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
                  {new Date(c.occurred_on).toLocaleDateString('en-IN',
                    { day: 'numeric', month: 'short' })}
                  {c.status === 'part_paid' && ` · ${format(Number(c.received))} in`}
                  {c.status === 'settled' && ' · settled'}
                  {c.status === 'written_off' && ' · written off'}
                  {c.note ? ` · ${c.note}` : ''}
                </span>
              </Link>
              <span className="t" style={{
                fontSize: 16,
                color: c.status === 'settled' ? 'var(--c-ok)'
                  : c.status === 'written_off' ? 'var(--c-meta)'
                  : c.status === 'part_paid' ? 'var(--c-warn)' : 'var(--c-ink)',
              }}>
                {format(Number(c.status === 'open' || c.status === 'part_paid'
                  ? c.outstanding : c.expected_amount))}
              </span>
            </div>

            {canEdit && (c.status === 'open' || c.status === 'part_paid') && (
              settling === c.id ? (
                <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <Field label="How much came back" name="amount" inputMode="decimal" required
                    autoFocus defaultValue={String(Number(c.outstanding) / 100)} />
                  <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>Into</span>
                    <select name="methodId" required style={{
                      minHeight: 50, borderRadius: 12, border: '1px solid var(--c-border)',
                      background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 15,
                      fontWeight: 600, padding: '0 12px',
                    }}>
                      {methods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name} — {m.funds}</option>
                      ))}
                    </select>
                  </label>
                  {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
                  <div style={{ display: 'flex', gap: 9 }}>
                    <button type="button" onClick={() => setSettling(null)} style={{
                      minHeight: 46, padding: '0 14px', borderRadius: 11, fontSize: 14,
                      fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
                    }}>Cancel</button>
                    <button type="submit" disabled={pending} style={{
                      flex: 1, minHeight: 46, borderRadius: 11, fontSize: 14.5, fontWeight: 600,
                      background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
                      opacity: pending ? 0.6 : 1,
                    }}>{pending ? 'Saving…' : 'Record it'}</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setSettling(c.id)} style={{
                    flex: 1, minHeight: 44, borderRadius: 11, fontSize: 13.5, fontWeight: 600,
                    background: 'var(--c-sunk)', color: 'var(--c-ink)',
                  }}>They paid me</button>
                  <form action={drop}>
                    <input type="hidden" name="claimId" value={c.id} />
                    <button type="submit" style={{
                      minHeight: 44, padding: '0 14px', borderRadius: 11, fontSize: 13.5,
                      fontWeight: 600, background: 'transparent', color: 'var(--c-meta)',
                    }}>Write off</button>
                  </form>
                </div>
              )
            )}
          </div>
        ))}
      </section>
      {live.length === 0 && (
        <p style={{ margin: '-14px 20px 22px', fontSize: 12.5, color: 'var(--c-meta)' }}>
          Nothing outstanding on shared costs.
        </p>
      )}
    </>
  );
}
