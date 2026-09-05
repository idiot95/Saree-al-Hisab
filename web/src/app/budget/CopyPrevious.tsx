'use client';

import { useActionState } from 'react';
import { copyPreviousMonth } from './actions';
import { format } from '@/lib/money';

export default function CopyPrevious({ month, from, total, categories }: {
  month: string; from: string; total: string; categories: number;
}) {
  const [state, act, pending] = useActionState(copyPreviousMonth, null);

  return (
    <form action={act} className="el" style={{
      margin: '0 18px 16px', background: 'var(--c-card)', borderRadius: 16, padding: 15,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <input type="hidden" name="month" value={month} />
      <span style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
        Nothing budgeted for this month yet. {from} came to <b style={{ color: 'var(--c-ink)' }}>
        {format(Number(total))}</b> across {categories} {categories === 1 ? 'category' : 'categories'}.
      </span>
      {state && !state.ok && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--c-danger)' }}>{state.error}</span>
      )}
      <button type="submit" disabled={pending} style={{
        minHeight: 48, borderRadius: 12, fontSize: 15, fontWeight: 600,
        background: 'var(--c-seagrass)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
      }}>{pending ? 'Copying…' : `Start from ${from}`}</button>
    </form>
  );
}
