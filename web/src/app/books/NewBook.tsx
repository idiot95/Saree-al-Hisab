'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { createBook } from './actions';

const KINDS = [
  { id: 'loan', label: 'Lending book', what: 'Money you have handed over and expect back.' },
  { id: 'reimbursement', label: 'Shared costs book', what: 'Things you paid for that others owe a share of.' },
] as const;

export default function NewBook() {
  const [state, act, pending] = useActionState(createBook, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="el" style={{
        margin: '0 var(--gutter) 22px', width: 'calc(100% - 36px)', minHeight: 56, borderRadius: 16,
        display: 'flex', alignItems: 'center', gap: 11, padding: '0 var(--pad)',
        background: 'var(--c-card)', border: '1px dashed var(--c-dash)',
        color: 'var(--c-ink)', fontSize: 'var(--step-0)', fontWeight: 600,
      }}>
        <span style={{
          width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        </span>
        New book
      </button>
    );
  }

  return (
    <form action={act} className="el" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <Field label="Name" name="name" required maxLength={60}
        placeholder="The Pune flat" autoFocus />
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          What sort of book
        </legend>
        {KINDS.map((k, i) => (
          <label key={k.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '11px 13px',
            borderRadius: 13, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
            cursor: 'pointer',
          }}>
            <input type="radio" name="kind" value={k.id} defaultChecked={i === 0}
              style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--c-seagrass)', flex: 'none' }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{k.label}</span>
              <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--c-meta)' }}>{k.what}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field label="Note (optional)" name="note" maxLength={200} />
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Creating…' : 'Create book'}</button>
      </div>
    </form>
  );
}
