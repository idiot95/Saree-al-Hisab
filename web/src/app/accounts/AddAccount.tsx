'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { addAccount } from './actions';

const KINDS = [
  { id: 'spending', label: 'Bank account', what: 'Salary lands, bills leave. The workhorse.' },
  { id: 'cash', label: 'Cash', what: 'What is actually in your wallet, allegedly.' },
  { id: 'savings', label: 'Savings or deposit', what: 'Sits outside the budget. Spending it is a decision, not a Tuesday.' },
  { id: 'credit', label: 'Credit card', what: 'Money you have not spent yet, in a manner of speaking.' },
] as const;

export default function AddAccount({ startOpen = false }: { startOpen?: boolean }) {
  const [state, act, pending] = useActionState(addAccount, null);
  const [open, setOpen] = useState(startOpen);
  const [kind, setKind] = useState<string>('spending');

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="el" style={{
        margin: '0 18px 22px', width: 'calc(100% - 36px)', minHeight: 58, borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 11, padding: '0 16px',
        background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
        color: 'var(--c-ink)', fontSize: 15, fontWeight: 600,
      }}>
        <Plus /> Add somewhere money sits
        {state?.ok && state.message && (
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--c-ok)' }}>added</span>
        )}
      </button>
    );
  }

  return (
    <form action={act} className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          What sort of thing is it
        </legend>
        {KINDS.map((k) => (
          <label key={k.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '11px 13px',
            borderRadius: 13, cursor: 'pointer',
            background: kind === k.id ? 'var(--c-teal-l)' : 'var(--c-sunk2)',
            border: `1px solid ${kind === k.id ? 'var(--c-seagrass)' : 'var(--c-border)'}`,
          }}>
            <input type="radio" name="kind" value={k.id} checked={kind === k.id}
              onChange={() => setKind(k.id)}
              style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--c-seagrass)', flex: 'none' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{k.label}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--c-meta)' }}>{k.what}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <Field label="What you call it" name="name" required maxLength={60}
        placeholder={kind === 'credit' ? 'HDFC Regalia' : kind === 'cash' ? 'Wallet' : 'HDFC Savings'} />

      {kind !== 'cash' && (
        <Field label="Last four digits, if you like" name="last4" inputMode="numeric"
          maxLength={4} placeholder="8802"
          hint="Only so you can tell two of them apart at a glance." />
      )}

      {kind === 'credit' ? (
        <>
          <Field label="Owed on it right now" name="opening" inputMode="decimal" placeholder="0"
            hint="Leave it at zero if the bill is clear. Enter it as a positive number — we know which way it points." />
          <Field label="Credit limit" name="limit" inputMode="decimal" placeholder="200000"
            hint="Optional, and mostly so the app can tell you how close you are sailing." />
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ flex: 1 }}>
              <Field label="Statement day" name="statement_day" inputMode="numeric"
                required placeholder="5" maxLength={2} />
            </span>
            <span style={{ flex: 1 }}>
              <Field label="Bill due day" name="due_day" inputMode="numeric"
                required placeholder="12" maxLength={2} />
            </span>
          </div>
          <p style={{
            margin: 0, padding: '11px 13px', borderRadius: 12, background: 'var(--c-teal-l)',
            color: 'var(--c-ink)', fontSize: 12.5, lineHeight: 1.5,
          }}>
            This is the bit that does the work. Every purchase on this card files itself into the
            right billing cycle on its own, so when the statement lands you are not squinting at
            dates. Days 1&ndash;28 only, because February exists.
          </p>
        </>
      ) : (
        <Field label="What is in it today" name="opening" inputMode="decimal" placeholder="0"
          hint="The starting line. Everything you record from here moves it." />
      )}

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5, fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Never mind</button>
        <button type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15.5, fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Opening it…' : 'Add it'}</button>
      </div>
    </form>
  );
}

function Plus() {
  return (
    <span style={{
      width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--c-sunk)', color: 'var(--c-meta)',
    }}>
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
    </span>
  );
}
