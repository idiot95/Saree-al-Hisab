'use client';

import { useActionState } from 'react';
import { copyPreviousMonth } from './actions';
import { useMoney } from '@/app/currency';

export default function CopyPrevious({ month, from, total, categories }: {
  month: string; from: string; total: string; categories: number;
}) {
  const { format } = useMoney();
  const [state, act, pending] = useActionState(copyPreviousMonth, null);

  return (
    <form action={act} className="border border-border" style={{
      margin: '0 var(--gutter) 16px', background: 'var(--card)', borderRadius: 16, padding: 15,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <input type="hidden" name="month" value={month} />
      <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
        Nothing budgeted for this month yet. {from} came to <b style={{ color: 'var(--foreground)' }}>
        {format(Number(total))}</b> across {categories} {categories === 1 ? 'category' : 'categories'}.
      </span>
      {state && !state.ok && (
        <span role="alert" style={{ fontSize: 'var(--step--1)', color: 'var(--destructive)' }}>{state.error}</span>
      )}
      <button className="cta" type="submit" disabled={pending} style={{
        minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
        background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: pending ? 0.65 : 1,
      }}>{pending ? 'Copying…' : `Start from ${from}`}</button>
    </form>
  );
}
