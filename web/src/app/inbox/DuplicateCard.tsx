'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { notDuplicate, dropDuplicate } from './actions';
import { format } from '@/lib/money';

type Side = {
  id: string; amount: string; on: string; merchant: string | null;
  who: string; account: string; category: string | null;
};

/* The two sides are shown whole, side by side, because the decision cannot be
   made from a summary: what differs between them IS the question. Rule B in
   particular flags entries on different accounts, which is exactly the case
   where the pair looks least alike and is most likely to be one purchase. */
export default function DuplicateCard({ low, high, reason }: {
  low: Side; high: Side; reason: 'same_account' | 'two_people';
}) {
  const [keepState, keep, keeping] = useActionState(notDuplicate, null);
  const [dropState, drop, dropping] = useActionState(dropDuplicate, null);
  const err = (keepState && !keepState.ok && keepState.error)
    || (dropState && !dropState.ok && dropState.error);

  return (
    <section className="el" style={{
      margin: '0 18px 14px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700,
          letterSpacing: '.03em', padding: '5px 9px', borderRadius: 7,
          background: 'var(--c-warn-tint)', color: 'var(--c-warn)',
        }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.4v.1" />
          </svg>
          POSSIBLY THE SAME THING
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-meta)' }}>
        {reason === 'two_people'
          ? `${low.who} and ${high.who} each recorded this. The accounts differ, which is usually the sign of one purchase entered twice rather than two purchases.`
          : 'The same amount, on the same account, within three days.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[low, high].map((s, i) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px',
            borderRadius: 13, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
          }}>
            <Link href={`/entries/${s.id}`} style={{
              flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3,
              textDecoration: 'none', color: 'var(--c-ink)',
            }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>
                {s.merchant || s.category || 'Entry'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--c-meta)' }}>
                {new Date(s.on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}{s.account}{' · '}{s.who}
              </span>
            </Link>
            <span className="t" style={{ fontSize: 16 }}>{format(Number(s.amount))}</span>
            <form action={drop}>
              <input type="hidden" name="txnId" value={s.id} />
              <button type="submit" disabled={dropping} style={{
                minHeight: 44, padding: '0 11px', borderRadius: 10, fontSize: 12.5,
                fontWeight: 600, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
                opacity: dropping ? 0.6 : 1,
              }}>{i === 0 ? 'Delete this' : 'Delete this'}</button>
            </form>
          </div>
        ))}
      </div>

      {err && (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--c-danger)' }}>{err}</p>
      )}

      <form action={keep}>
        <input type="hidden" name="lowId" value={low.id} />
        <input type="hidden" name="highId" value={high.id} />
        <button type="submit" disabled={keeping} style={{
          width: '100%', minHeight: 48, borderRadius: 12, fontSize: 14.5, fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-ink)', opacity: keeping ? 0.6 : 1,
        }}>{keeping ? 'Saving…' : 'They are both real — keep them'}</button>
      </form>
    </section>
  );
}
