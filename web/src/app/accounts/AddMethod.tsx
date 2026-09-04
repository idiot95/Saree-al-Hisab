'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { addMethod } from './actions';

type Acc = { id: string; name: string; kind: string };

/* The rails a given account can carry, mirroring what the database will allow.
   Offering an impossible pairing and then refusing it is worse than not
   offering it: the person learns the rule by being told off. */
const RAILS = [
  { id: 'upi', label: 'UPI', hint: 'GPay, PhonePe, Paytm', on: ['spending', 'cash'] },
  { id: 'card', label: 'Card', hint: 'The card itself', on: ['credit'] },
  { id: 'netbanking', label: 'Net banking', hint: 'Direct from the bank', on: ['spending'] },
  { id: 'autodebit', label: 'Auto-debit', hint: 'Standing instruction', on: ['spending', 'credit'] },
  { id: 'cash', label: 'Cash', hint: 'Notes', on: ['cash', 'spending'] },
  { id: 'wallet', label: 'Wallet', hint: 'Paytm and similar', on: ['spending', 'cash'] },
  { id: 'cheque', label: 'Cheque', hint: '', on: ['spending'] },
] as const;

export default function AddMethod({ accounts, startOpen = false }: { accounts: Acc[]; startOpen?: boolean }) {
  const [state, act, pending] = useActionState(addMethod, null);
  const [open, setOpen] = useState(startOpen);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');

  const account = accounts.find((a) => a.id === accountId);
  const allowed = RAILS.filter((r) => account && (r.on as readonly string[]).includes(account.kind));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="el" style={{
        margin: '0 18px 22px', width: 'calc(100% - 36px)', minHeight: 58, borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 11, padding: '0 16px',
        background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
        color: 'var(--c-ink)', fontSize: 15, fontWeight: 600,
      }}>
        <span style={{
          width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </span>
        Add a payment method
      </button>
    );
  }

  return (
    <form action={act} className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>
          Draws on
        </span>
        <select name="funding_account_id" value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          style={{
            minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
            background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 15.5,
            fontWeight: 600, padding: '0 12px',
          }}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)' }}>
          Spending on this method is recorded against this account.
        </span>
      </label>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Type
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {allowed.map((r, i) => (
            <label key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '9px 13px',
              borderRadius: 12, cursor: 'pointer', background: 'var(--c-sunk2)',
              border: '1px solid var(--c-border)',
            }}>
              <input type="radio" name="kind" value={r.id} defaultChecked={i === 0}
                style={{ width: 17, height: 17, accentColor: 'var(--c-seagrass)' }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--c-meta)' }}>{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {allowed.length === 0 && (
          <span style={{ fontSize: 12.5, color: 'var(--c-meta)' }}>
            No payment method can draw on that account type.
          </span>
        )}
      </fieldset>

      <Field label="Name" name="name" required maxLength={60} placeholder="GPay" />
      <Field label="Handle or reference (optional)" name="handle" maxLength={60}
        placeholder="you@okhdfc" />

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}

      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 14.5, fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button type="submit" disabled={pending || allowed.length === 0} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 15.5, fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
          opacity: pending || allowed.length === 0 ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Add payment method'}</button>
      </div>
    </form>
  );
}
