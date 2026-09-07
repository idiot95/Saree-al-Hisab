'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { addPerson } from './actions';

const HOW = [
  { id: 'family', label: 'Family' }, { id: 'friend', label: 'Friend' },
  { id: 'work', label: 'Work' }, { id: 'vendor', label: 'Vendor' },
] as const;

export default function AddPerson({ startOpen = false }: { startOpen?: boolean }) {
  const [state, act, pending] = useActionState(addPerson, null);
  const [open, setOpen] = useState(startOpen);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="el card" style={{
        margin: '0 var(--gutter) 22px', width: 'calc(100% - 36px)', minHeight: 58, borderRadius: 16,
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
        Add a person
      </button>
    );
  }

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <Field label="Name" name="name" required maxLength={60} placeholder="Ahmed Raza" autoFocus />
      <Field label="Phone (optional)" name="phone" inputMode="tel" maxLength={20} />
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          How you know them
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {HOW.map((h, i) => (
            <label key={h.id} style={{
              minHeight: 44, display: 'flex', alignItems: 'center', gap: 7, padding: '0 13px',
              borderRadius: 999, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
              fontSize: 'var(--step--1)', fontWeight: 600, cursor: 'pointer',
            }}>
              <input type="radio" name="relationship" value={h.id} defaultChecked={i === 1}
                style={{ width: 16, height: 16, accentColor: 'var(--c-seagrass)' }} />
              {h.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 9 }}>
        <button className="cta" type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button className="cta" type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Add person'}</button>
      </div>
    </form>
  );
}
