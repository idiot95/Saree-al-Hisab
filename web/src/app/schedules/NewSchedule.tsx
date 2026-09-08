'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { buildRule, friendlyDate, maxDay, nextDates, type Calendar } from '@/lib/recur';
import { HIJRI_MONTHS, HIJRI_MONTHS_SHORT, formatHijri, toHijri } from '@/lib/hijri';
import { createSchedule } from './actions';

type Method = { id: string; name: string; funds: string };
type Cat = { id: string; name: string };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

/* Two calendars, one grammar. A household here keeps Hijri dates for the
   things that matter most — Ramadaan, Eid, Ashara, the yearly dues — and the
   Misri calendar is arithmetic, so "the 1st of Ramadaan" is a real date on
   the phone years ahead. The month names are the ones the community uses. */
const CALENDARS: [Calendar, string][] = [['gregorian', 'English months'], ['hijri', 'Hijri (Misri)']];

export default function NewSchedule({ methods, categories, startOpen = false }: {
  methods: Method[]; categories: Cat[]; startOpen?: boolean;
}) {
  const [state, act, pending] = useActionState(createSchedule, null);
  const [open, setOpen] = useState(startOpen);
  const [freq, setFreq] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [cal, setCal] = useState<Calendar>('gregorian');
  const [month, setMonth] = useState({ gregorian: 4, hijri: 9 });   // April; Ramadaan
  const [day, setDay] = useState({ gregorian: 5, hijri: 1 });
  const [ends, setEnds] = useState<'never' | 'after' | 'on'>('never');
  const [times, setTimes] = useState(5);
  const [untilDate, setUntilDate] = useState('');
  // Fixed once, at open, so a render is not a clock and nothing flickers at midnight.
  const [today] = useState(() => new Date());

  const top = maxDay(cal, freq, month[cal]);
  const chosenDay = Math.min(day[cal], top);
  const base = freq === 'YEARLY'
    ? buildRule({ freq: 'YEARLY', day: chosenDay, month: month[cal] })
    : buildRule({ freq: 'MONTHLY', day: chosenDay });
  // The same arithmetic the server will do, shown before anyone commits to it.
  const last = ends === 'after'
    ? nextDates(base, today, Math.min(Math.max(times, 1), 600), cal).at(-1)
    : ends === 'on' && untilDate
      ? nextDates(base, today, 600, cal).filter((d) => d <= untilDate).at(-1)
      : undefined;
  const monthNames = cal === 'hijri' ? HIJRI_MONTHS : MONTHS;
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
        Add a payment or income that comes round
      </button>
    );
  }

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <div role="tablist" aria-label="Paid out or paid in" style={{
        display: 'flex', gap: 3, padding: 3, background: 'var(--c-sunk)', borderRadius: 999,
      }}>
        {([['expense', 'Goes out'], ['income', 'Comes in']] as const).map(([id, label]) => {
          const on = kind === id;
          return (
            <label key={id} style={{
              position: 'relative', flex: 1, minHeight: 44, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 999, cursor: 'pointer',
              fontSize: 'var(--step--1)', fontWeight: 600,
              background: on ? 'var(--c-card)' : 'transparent',
              color: on ? 'var(--c-ink)' : 'var(--c-meta)',
              boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : undefined,
            }}>
              <input type="radio" name="kind" value={id} checked={on} onChange={() => setKind(id)}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
              {label}
            </label>
          );
        })}
      </div>
      <Field label="What is it" name="name" required maxLength={60}
        placeholder={kind === 'income' ? 'Salary' : 'Rent'} autoFocus />
      <Field label="Amount" name="amount" inputMode="decimal" required
        placeholder={kind === 'income' ? '120000' : '45000'} />

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          How often
        </legend>
        <div style={{ display: 'flex', gap: 7 }}>
          {[['MONTHLY', 'Every month'], ['YEARLY', 'Once a year']].map(([id, label], i) => (
            <label key={id} style={chip(freq === id)}>
              <input type="radio" name="freq" value={id} defaultChecked={i === 0}
                onChange={() => setFreq(id as 'MONTHLY' | 'YEARLY')}
                style={{ width: 16, height: 16, accentColor: 'var(--c-seagrass)' }} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          On which calendar
        </legend>
        <div style={{ display: 'flex', gap: 7 }}>
          {CALENDARS.map(([id, label]) => (
            <label key={id} style={chip(cal === id)}>
              <input type="radio" name="calendar" value={id} checked={cal === id}
                onChange={() => setCal(id)}
                style={{ width: 16, height: 16, accentColor: 'var(--c-seagrass)' }} />
              {label}
            </label>
          ))}
        </div>
        {cal === 'hijri' && (
          <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            Today is {formatHijri(toHijri({ y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }))}
            {' '}by the Misri calendar — the fixed one, so every date ahead is already known.
          </p>
        )}
      </fieldset>

      <div style={{ display: 'flex', gap: 10 }}>
        {freq === 'YEARLY' && (
          <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Month</span>
            <select name="month" value={month[cal]} style={select}
              onChange={(e) => setMonth({ ...month, [cal]: Number(e.target.value) })}>
              {monthNames.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        )}
        <label style={{ flex: freq === 'YEARLY' ? '0 0 96px' : 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Day</span>
          <select name="day" value={chosenDay} style={select}
            onChange={(e) => setDay({ ...day, [cal]: Number(e.target.value) })}>
            {Array.from({ length: top }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        {cal === 'gregorian'
          ? 'Days go up to 28, because every month has one. A reminder that moves is worse than none.'
          : freq === 'MONTHLY'
            ? 'Days go up to 29, because every Hijri month has one. A reminder that moves is worse than none.'
            : `${HIJRI_MONTHS_SHORT[month.hijri - 1]} has ${top} days${top === 29 && month.hijri === 12 ? ' in most years, so the 30th is left out' : ''}.`}
      </p>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
          Ends
        </legend>
        <div style={{ display: 'flex', gap: 7 }}>
          {([['never', 'Never'], ['after', 'After a number'], ['on', 'On a date']] as const).map(([id, label]) => (
            <label key={id} style={chip(ends === id)}>
              <input type="radio" name="ends" value={id} checked={ends === id}
                onChange={() => setEnds(id)}
                style={{ width: 16, height: 16, accentColor: 'var(--c-seagrass)' }} />
              {label}
            </label>
          ))}
        </div>
        {ends === 'after' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input name="times" type="number" inputMode="numeric" min={1} max={600} required
              value={times} onChange={(e) => setTimes(Number(e.target.value))}
              aria-label="How many times"
              style={{ ...select, width: 96, textAlign: 'center' }} />
            <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
              {times === 1 ? 'once' : `${times} times`}{last ? ` — the last on ${friendlyDate(last)}` : ''}
            </span>
          </div>
        )}
        {ends === 'on' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input name="untilDate" type="date" min={iso} required value={untilDate}
              onChange={(e) => setUntilDate(e.target.value)} aria-label="Last date"
              style={{ ...select, flex: 1, minWidth: 0 }} />
            {untilDate && (
              <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
                {last ? `last on ${friendlyDate(last)}` : 'none before then'}
              </span>
            )}
          </div>
        )}
      </fieldset>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
          {kind === 'income' ? 'Arrives by' : 'Paid with'}
        </span>
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
        <button className="cta" type="button" onClick={() => setOpen(false)} style={{
          minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button className="cta" type="submit" disabled={pending} style={{
          flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
        }}>{pending ? 'Saving…' : 'Add it'}</button>
      </div>
    </form>
  );
}

const chip = (on: boolean): React.CSSProperties => ({
  flex: 1, minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 7, padding: '0 6px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
  fontSize: 'var(--step--1)', fontWeight: 600, lineHeight: 1.2,
  background: on ? 'var(--c-teal-l)' : 'var(--c-sunk2)',
  border: `1px solid ${on ? 'var(--c-seagrass)' : 'var(--c-border)'}`,
});

const select: React.CSSProperties = {
  minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
  background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
  fontWeight: 600, padding: '0 12px',
};
