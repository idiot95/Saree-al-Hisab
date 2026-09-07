'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { createSchedule } from './actions';

type Method = { id: string; name: string; funds: string };
type Cat = { id: string; name: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

export default function NewSchedule({ methods, categories, startOpen = false }: {
  methods: Method[]; categories: Cat[]; startOpen?: boolean;
}) {
  const [state, act, pending] = useActionState(createSchedule, null);
  const [open, setOpen] = useState(startOpen);
  const [freq, setFreq] = useState('MONTHLY');

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
        Add a scheduled payment
      </button>
    );
  }

  return (
    <form action={act} className="el" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <Field label="What is it" name="name" required maxLength={60}
        placeholder="Rent" autoFocus />
      <Field label="Amount" name="amount" inputMode="decimal" required placeholder="45000" />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          How often
        </legend>
        <div style={{ display: 'flex', gap: 7 }}>
          {[['MONTHLY', 'Every month'], ['YEARLY', 'Once a year']].map(([id, label], i) => (
            <label key={id} style={{
              flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, borderRadius: 12, cursor: 'pointer', fontSize: 'var(--step--1)', fontWeight: 600,
              background: freq === id ? 'var(--c-teal-l)' : 'var(--c-sunk2)',
              border: `1px solid ${freq === id ? 'var(--c-seagrass)' : 'var(--c-border)'}`,
            }}>
              <input type="radio" name="freq" value={id} defaultChecked={i === 0}
                onChange={() => setFreq(id)}
                style={{ width: 16, height: 16, accentColor: 'var(--c-seagrass)' }} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ display: 'flex', gap: 10 }}>
        {freq === 'YEARLY' && (
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Month</span>
            <select name="month" defaultValue="4" style={select}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        )}
        <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Day</span>
          <select name="day" defaultValue="5" style={select}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        Days go up to 28, because every month has one. A reminder that moves is worse than none.
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Paid with</span>
        <select name="methodId" required style={select}>
          {methods.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.funds}</option>)}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Category</span>
        <select name="categoryId" required style={select}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div style={{ display: 'flex', gap: 9 }}>
        <button type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-seagrass)', color: 'var(--c-on-fill)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Add it'}</button>
      </div>
    </form>
  );
}

const select: React.CSSProperties = {
  minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
  background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--step-0)',
  fontWeight: 600, padding: '0 12px',
};
