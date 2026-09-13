'use client';

import { useActionState, useCallback, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { Icon } from '../Icon';
import { haptic } from '../haptics';
import Sheet from '../Sheet';
import { createTab } from './actions';
import NewPeople from './NewPeople';

/* Opening a tab asks for nothing it cannot do without. The name is optional —
   left blank, the tab is named after whoever is on it — and so are the people:
   a tab with nobody on it still takes costs and still counts in what you are
   owed. People come from the phone's address book where the browser has one,
   or are typed; either way they are only names on this tab, and a name that
   is already on another tab is the same person, not a second one. */
export default function NewTab() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [state, act, pending] = useActionState(createTab, null);

  return (
    <>
      <button type="button" onClick={() => { haptic('select'); setOpen(true); }} className="el card" style={{
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
          <Icon name="plus" size={16} strokeWidth={2.2} />
        </span>
        New tab
      </button>

      <Sheet open={open} onClose={close} label="New tab">
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 2 }}>
          <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>New tab</h2>
          <Field label="Name · optional" name="name" maxLength={60}
            placeholder="Goa weekend, Office petrol…" autoComplete="off" />

          <div role="group" aria-label="Who owes on it" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
              Who owes on it · optional
            </span>
            <NewPeople />
            <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
              A cost on this tab splits equally between the people on it. Leave it empty and the
              tab still counts in what you are owed.
            </p>
          </div>

          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cta" type="button" onClick={close} style={{
              minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Cancel</button>
            <button className="cta" type="submit" disabled={pending} style={{
              flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
            }}>
              <Icon name="folder" size={18} strokeWidth={2} />
              {pending ? 'Opening…' : 'Open the tab'}
            </button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
