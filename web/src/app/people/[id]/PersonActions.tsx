'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { lend, recordRepayment, writeOff } from '../actions';
import { format } from '@/lib/money';

type Method = { id: string; name: string; funds: string };
type Cat = { id: string; name: string };

/* Three actions, three shapes, and the copy says which is which — because the
   difference between them is the entire point. Lending and repayment move
   money without spending it. Writing off is the moment it becomes spending. */
export default function PersonActions({ personId, name, balance, methods, categories }: {
  personId: string; name: string; balance: number; methods: Method[]; categories: Cat[];
}) {
  const [mode, setMode] = useState<null | 'lend' | 'back' | 'off'>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [lendState, lendAct, lending] = useActionState(lend, null);
  const [backState, backAct, paying] = useActionState(recordRepayment, null);
  const [offState, offAct, forgiving] = useActionState(writeOff, null);

  if (mode === null) {
    return (
      <div style={{ display: 'flex', gap: 9, margin: '0 18px 20px' }}>
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
    <div className="el" style={{
      margin: '0 18px 20px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
    }}>
      {mode === 'lend' && (
        <form action={lendAct} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          <Title>Lend to {name}</Title>
          <Explain>Not spending. The money moves from your account into theirs.</Explain>
          {common}
          <Select label="Out of" name="methodId" options={methods.map((m) => ({
            value: m.id, label: `${m.name} — ${m.funds}` }))} />
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
          <Select label="Into" name="methodId" options={methods.map((m) => ({
            value: m.id, label: `${m.name} — ${m.funds}` }))} />
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
            defaultValue={balance > 0 ? String(balance / 100) : ''} />
          <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
          <Select label="Count it under" name="categoryId"
            options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {offState && !offState.ok && <ErrorNote>{offState.error}</ErrorNote>}
          <Row onCancel={() => setMode(null)} pending={forgiving} label="Write it off" danger />
        </form>
      )}

      {mode !== 'off' && balance > 0 && (
        <button type="button" onClick={() => setMode('off')} style={{
          marginTop: 12, minHeight: 44, width: '100%', fontSize: 13.5, fontWeight: 600,
          color: 'var(--c-meta)', background: 'transparent',
        }}>
          Or write off the {format(balance)} they owe
        </button>
      )}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{children}</h2>;
}
function Explain({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>{children}</p>
  );
}
function Select({ label, name, options }: {
  label: string; name: string; options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      <select name={name} required style={{
        minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
        background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 15.5,
        fontWeight: 600, padding: '0 12px',
      }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
function Row({ onCancel, pending, label, danger }: {
  onCancel: () => void; pending: boolean; label: string; danger?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      <button type="button" onClick={onCancel} style={{
        minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5, fontWeight: 600,
        background: 'var(--c-sunk)', color: 'var(--c-meta)',
      }}>Cancel</button>
      <button type="submit" disabled={pending} style={{
        flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15.5, fontWeight: 600,
        opacity: pending ? 0.65 : 1,
        background: danger ? 'var(--c-danger-tint)' : 'var(--c-seagrass)',
        color: danger ? 'var(--c-danger)' : 'var(--c-on-fill)',
      }}>{pending ? 'Saving…' : label}</button>
    </div>
  );
}
function Btn({ children, onClick, primary }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className={primary ? 'el2' : 'el'} style={{
      flex: 1, minHeight: 54, borderRadius: 14, fontSize: 15, fontWeight: 600,
      background: primary
        ? 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
          + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)'
        : 'var(--c-card)',
      color: primary ? '#fff' : 'var(--c-ink)',
      border: primary ? 0 : '1px solid var(--c-border)',
    }}>{children}</button>
  );
}
