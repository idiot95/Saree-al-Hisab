'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { addAccount } from './actions';

const KINDS = [
  { id: 'spending', label: 'Bank account', what: 'Salary in, bills out.' },
  { id: 'cash', label: 'Cash', what: 'Notes in your wallet.' },
  { id: 'savings', label: 'Savings or deposit', what: 'Kept outside the monthly budget.' },
  { id: 'credit', label: 'Credit card', what: 'Tracks what you owe and when the bill is due.' },
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
        <Plus /> Add an account
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
          Type
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

      <Field label="Name" name="name" required maxLength={60}
        placeholder={kind === 'credit' ? 'HDFC Regalia' : kind === 'cash' ? 'Wallet' : 'HDFC Savings'} />

      {kind !== 'cash' && (
        <Field label="Last four digits (optional)" name="last4" inputMode="numeric"
          maxLength={4} placeholder="8802" />
      )}

      {kind === 'credit' ? (
        <>
          <Field label="Currently owed" name="opening" inputMode="decimal" placeholder="0"
            hint="Leave at 0 if the bill is cleared." />
          <Field label="Credit limit (optional)" name="limit" inputMode="decimal" placeholder="200000" />
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
            Purchases on this card are filed into the right billing cycle automatically.
            Use a day between 1 and 28 &mdash; every month has one.
          </p>
        </>
      ) : (
        <Field label="Current balance" name="opening" inputMode="decimal" placeholder="0" />
      )}

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5, fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15.5, fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Add account'}</button>
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
