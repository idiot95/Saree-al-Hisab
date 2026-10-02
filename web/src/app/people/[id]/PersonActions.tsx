'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { lend, recordRepayment, writeOff } from '../actions';
import { useMoney } from '@/app/currency';
import PayPicker from '../../PayPicker';
import CategoryPick from '../../CategoryPick';
import type { Category } from '../../CategoryFinder';
import { defaultRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';

/* Three actions, three shapes, and the copy says which is which — because the
   difference between them is the entire point. Lending and repayment move
   money without spending it. Writing off is the moment it becomes spending. */
export default function PersonActions({ personId, name, balance, ways, categories }: {
  personId: string; name: string; balance: number; ways: Way[]; categories: Category[];
}) {
  const { format, toKeys } = useMoney();
  const [mode, setMode] = useState<null | 'lend' | 'back' | 'off'>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [lendState, lendAct, lending] = useActionState(lend, null);
  const [backState, backAct, paying] = useActionState(recordRepayment, null);
  const [offState, offAct, forgiving] = useActionState(writeOff, null);

  if (mode === null) {
    return (
      <div style={{ display: 'flex', gap: 9, margin: '0 var(--gutter) 20px' }}>
        <Btn onClick={() => setMode('lend')} primary>Lend money</Btn>
        <Btn onClick={() => setMode('back')}>Got money back</Btn>
      </div>
    );
  }

  const common = (
    <>
      <input type="hidden" name="personId" value={personId} />
      <Field label="Amount" name="amount" inputMode="decimal" required autoFocus placeholder="0" />
      <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
    </>
  );

  return (
    <div className="border border-border" style={{
      margin: '0 var(--gutter) 20px', background: 'var(--card)', borderRadius: 18, padding: 16,
    }}>
      {mode === 'lend' && (
        <form action={lendAct} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Title>Lend to {name}</Title>
          <Explain>Not spending. The money moves from your account into theirs.</Explain>
          {common}
          <PayField label="How you sent it" ways={ways} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {lendState && !lendState.ok && <ErrorNote>{lendState.error}</ErrorNote>}
          <Row onCancel={() => setMode(null)} pending={lending} label="Record loan" />
        </form>
      )}

      {mode === 'back' && (
        <form action={backAct} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Title>{name} paid you back</Title>
          <Explain>Not income either — it was never spending, so getting it back is not earning.</Explain>
          {common}
          <PayField label="How it came back" ways={ways} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {backState && !backState.ok && <ErrorNote>{backState.error}</ErrorNote>}
          <Row onCancel={() => setMode(null)} pending={paying} label="Record repayment" />
        </form>
      )}

      {mode === 'off' && (
        <form action={offAct} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Title>Write off what {name} owes</Title>
          <Explain>
            This <b>is</b> spending, counted in the month you forgive it. Until now the money was
            still yours; from here it has been spent.
          </Explain>
          <input type="hidden" name="personId" value={personId} />
          <Field label="Amount" name="amount" inputMode="decimal" required autoFocus
            defaultValue={balance > 0 ? toKeys(balance) : ''} />
          <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
          {/* A write-off is spending, so only a category for spending will do. */}
          <CategoryPick label="Count it under" name="categoryId"
            categories={categories.filter((c) => fits(c.scope, 'expense'))} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {offState && !offState.ok && <ErrorNote>{offState.error}</ErrorNote>}
          <Row onCancel={() => setMode(null)} pending={forgiving} label="Write it off" danger />
        </form>
      )}

      {mode !== 'off' && balance > 0 && (
        <button type="button" onClick={() => setMode('off')} style={{
          marginTop: 12, minHeight: 44, width: '100%', fontSize: 'var(--step--1)', fontWeight: 600,
          color: 'var(--muted-foreground)', background: 'transparent',
        }}>
          Or write off the {format(balance)} they owe
        </button>
      )}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>{children}</h2>;
}
function Explain({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>{children}</p>
  );
}
function PayField({ label, ways }: { label: string; ways: Way[] }) {
  return (
    <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>{label}</span>
      <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
    </div>
  );
}
function Row({ onCancel, pending, label, danger }: {
  onCancel: () => void; pending: boolean; label: string; danger?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      <button className="cta" type="button" onClick={onCancel} style={{
        minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
        background: 'var(--muted)', color: 'var(--muted-foreground)',
      }}>Cancel</button>
      <button className="cta" type="submit" disabled={pending} style={{
        flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
        opacity: pending ? 0.65 : 1,
        background: danger ? 'color-mix(in srgb, var(--destructive) 12%, transparent)' : 'var(--chart-1)',
        color: danger ? 'var(--destructive)' : 'var(--attention-soft-foreground)',
      }}>{pending ? 'Saving…' : label}</button>
    </div>
  );
}
function Btn({ children, onClick, primary }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={`${primary ? 'el2' : 'el'} cta`} style={{
      flex: 1, minHeight: 54, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
      background: primary
        ? 'var(--primary)'
        : 'var(--card)',
      color: primary ? 'var(--primary-foreground)' : 'var(--foreground)',
      border: primary ? 0 : '1px solid var(--border)',
    }}>{children}</button>
  );
}
