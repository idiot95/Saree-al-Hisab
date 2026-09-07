'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { Icon } from '../Icon';
import { createTab } from './actions';
import { SPLITS } from './splits';

type Person = { id: string; name: string; tint: string };

export default function NewTab({ people }: { people: Person[] }) {
  const [state, act, pending] = useActionState(createTab, null);
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="el card" style={{
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
        New tab
      </button>
    );
  }

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <Field label="Name" name="name" required maxLength={60}
        placeholder="The Pune flat" autoFocus />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0, marginBottom: 8 }}>
          Who is on it
        </legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {people.map((p) => {
            const on = ticked.has(p.id);
            return (
              <label key={p.id} style={{
                minHeight: 44, padding: '0 14px 0 10px', borderRadius: 999, display: 'flex',
                alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--step--1)', fontWeight: 600,
                background: on ? `var(--cat-${p.tint}-ink)` : `var(--cat-${p.tint})`,
                color: on ? '#fff' : `var(--cat-${p.tint}-ink)`,
                transition: 'background .15s, color .15s',
              }}>
                <input type="checkbox" name="counterpartyId" value={p.id} checked={on}
                  onChange={(e) => setTicked((s) => {
                    const n = new Set(s);
                    if (e.target.checked) n.add(p.id); else n.delete(p.id);
                    return n;
                  })}
                  style={{ width: 18, height: 18, margin: 0, accentColor: 'currentColor' }} />
                {p.name}
              </label>
            );
          })}
        </div>
        <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          {ticked.size === 0
            ? 'Tick the people who share this. You can add more later.'
            : `${ticked.size} ${ticked.size === 1 ? 'person' : 'people'}, and the household.`}
        </p>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0, marginBottom: 8 }}>
          How a cost on it is shared
        </legend>
        {SPLITS.map((k, i) => (
          <label key={k.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '11px 13px',
            borderRadius: 13, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
            cursor: 'pointer',
          }}>
            <input type="radio" name="split" value={k.id} defaultChecked={i === 0}
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
        <button className="cta" type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button className="cta" type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--g-primary)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
        }}>
          <Icon name="tab" size={18} strokeWidth={2} />
          {pending ? 'Opening…' : 'Open the tab'}
        </button>
      </div>
    </form>
  );
}
