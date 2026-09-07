'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { Icon } from '../Icon';
import { createTab } from './actions';
import NewPeople from './NewPeople';

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
      <Field label="Name" name="name" maxLength={60}
        placeholder="Office expenses — or leave blank to name it after them" autoFocus />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0, marginBottom: 8 }}>
          Who owes it back
        </legend>
        {people.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        </div>}
        <NewPeople known={people.map((p) => p.name)} />
        <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          {ticked.size === 0
            ? (people.length ? 'Tick who this tab is for, or name someone new. You can add more later.'
              : 'Name who this tab is for — the office, a cousin, the insurer. You can add more later.')
            : `A cost on this tab is owed back by ${ticked.size === 1 ? 'them' : `these ${ticked.size}, in equal shares`}.`}
        </p>
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
          background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
        }}>
          <Icon name="tab" size={18} strokeWidth={2} />
          {pending ? 'Opening…' : 'Open the tab'}
        </button>
      </div>
    </form>
  );
}
