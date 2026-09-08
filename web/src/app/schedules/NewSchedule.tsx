'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { buildRule, describeRule, friendlyDay, maxDay, nextDates, type Calendar } from '@/lib/recur';
import { HIJRI_MONTHS_SHORT, formatHijri, toHijri } from '@/lib/hijri';
import { DateChips, DayOfMonth, MonthOfYear, Segmented } from '../DatePick';
import { createSchedule } from './actions';
import PayPicker from '../PayPicker';
import CategoryPick from '../CategoryPick';
import type { Category } from '../CategoryFinder';
import { defaultRef, type Way } from '@/lib/pay';
import { fits } from '@/lib/scope';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Two calendars, one grammar. A household here keeps Hijri dates for the
   things that matter most — Ramadaan, Eid, Ashara, the yearly dues — and the
   Misri calendar is arithmetic, so "the 1st of Ramadaan" is a real date on
   the phone years ahead. The month names are the ones the community uses. */
const CALENDARS = [['gregorian', 'English'], ['hijri', 'Hijri']] as const;
const REPEATS = [['MONTHLY', 'Every month'], ['YEARLY', 'Once a year']] as const;
const ENDS = [['never', 'Never'], ['after', 'After a number'], ['on', 'On a date']] as const;

/* The form asks for a day the way the person thinks of it — the 5th, the
   1st of Ramadaan — as taps on a grid, and says back in one sentence what
   the rule will be and when it first lands. The end is one line, "Ends
   never", until someone wants otherwise. */

export default function NewSchedule({ ways, categories, startOpen = false }: {
  ways: Way[]; categories: Category[]; startOpen?: boolean;
}) {
  const [state, act, pending] = useActionState(createSchedule, null);
  const [open, setOpen] = useState(startOpen);
  const [freq, setFreq] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [cal, setCal] = useState<Calendar>('gregorian');
  const [month, setMonth] = useState({ gregorian: 4, hijri: 9 });   // April; Ramadaan
  const [day, setDay] = useState({ gregorian: 5, hijri: 1 });
  const [ends, setEnds] = useState<'never' | 'after' | 'on'>('never');
  const [endsOpen, setEndsOpen] = useState(false);
  const [times, setTimes] = useState(12);
  const [untilDate, setUntilDate] = useState('');
  // Fixed once, at open, so a render is not a clock and nothing flickers at midnight.
  const [today] = useState(() => new Date());

  const top = maxDay(cal, freq, month[cal]);
  const chosenDay = Math.min(day[cal], top);
  const base = freq === 'YEARLY'
    ? buildRule({ freq: 'YEARLY', day: chosenDay, month: month[cal] })
    : buildRule({ freq: 'MONTHLY', day: chosenDay });
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  // The same arithmetic the server will do, shown before anyone commits to it.
  const first = nextDates(base, today, 1, cal)[0];
  const last = ends === 'after'
    ? nextDates(base, today, Math.min(Math.max(times, 1), 600), cal).at(-1)
    : ends === 'on' && untilDate
      ? nextDates(base, today, 600, cal).filter((d) => d <= untilDate).at(-1)
      : undefined;
  const monthNames = cal === 'hijri' ? HIJRI_MONTHS_SHORT : MON;
  const sentence = describeRule(base, cal);
  // Salary is not a place to file the rent: the list follows the tab.
  const offered = categories.filter((c) => fits(c.scope, kind));
  const endsLine = ends === 'never' ? 'Ends never'
    : ends === 'after' ? `Ends after ${times === 1 ? 'once' : `${times} times`}${last ? `, on ${friendlyDay(last, iso)}` : ''}`
    : untilDate ? `Ends on ${friendlyDay(untilDate, iso)}${last && last !== untilDate ? ` — the last is ${friendlyDay(last, iso)}` : ''}` : 'Ends on a date';
  const later = [[6, 'In 6 months'], [12, 'In a year'], [24, 'In 2 years']] as const;

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
      <div role="tablist" aria-label="Expense or income" style={{
        display: 'flex', gap: 3, padding: 3, background: 'var(--c-sunk)', borderRadius: 999,
      }}>
        {([['expense', 'Expense'], ['income', 'Income']] as const).map(([id, label]) => {
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={row}>
          <span style={rowLabel}>Repeats</span>
          <Segmented name="freq" value={freq} options={REPEATS} onChange={setFreq} label="How often it repeats" />
        </div>
        <div style={row}>
          <span style={rowLabel}>Calendar</span>
          <Segmented name="calendar" value={cal} options={CALENDARS} onChange={setCal} label="Which calendar" />
        </div>

        {freq === 'YEARLY' && (
          <MonthOfYear value={month[cal]} names={monthNames} label={cal === 'hijri' ? 'Hijri month' : 'Month'}
            onPick={(v) => setMonth({ ...month, [cal]: v })} />
        )}
        <input type="hidden" name="month" value={month[cal]} />
        <DayOfMonth value={chosenDay} top={top} onPick={(v) => setDay({ ...day, [cal]: v })} />
        <input type="hidden" name="day" value={chosenDay} />

        <p style={{ margin: '2px 0 0', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, lineHeight: 1.3 }}>
            {sentence.charAt(0).toUpperCase()}{sentence.slice(1)}
          </span>
          <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            {first ? `First on ${friendlyDay(first, iso)}` : 'No date ahead'}
            {cal === 'hijri' && first && ` · ${formatHijri(toHijri(civil(first)), true)}`}
            {cal === 'hijri'
              ? `. Today is ${formatHijri(toHijri({ y: today.getFullYear(), m: today.getMonth() + 1, d: today.getDate() }), true)} by the Misri calendar.`
              : '. Days stop at the 28th so it lands in every month.'}
          </span>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {!endsOpen ? (
          <div style={row}>
            <span style={{ flex: 1, fontSize: 'var(--step--1)', fontWeight: 600 }}>{endsLine}</span>
            <input type="hidden" name="ends" value="never" />
            <button type="button" onClick={() => setEndsOpen(true)} style={{
              minHeight: 44, padding: '0 12px', borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-teal)',
            }}>Change</button>
          </div>
        ) : (
          <>
            <div style={row}>
              <span style={rowLabel}>Ends</span>
              <Segmented name="ends" value={ends} options={ENDS} label="When it ends"
                onChange={(v) => { setEnds(v); if (v === 'on' && !untilDate) setUntilDate(addMonths(iso, 12)); }} />
            </div>
            {ends === 'after' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-label="One fewer" onClick={() => setTimes(Math.max(1, times - 1))} style={stepBtn}>−</button>
                <input name="times" type="number" inputMode="numeric" min={1} max={600} required
                  value={times} onChange={(e) => setTimes(Math.min(600, Math.max(1, Number(e.target.value) || 1)))}
                  aria-label="How many times" className="t"
                  style={{ ...select, width: 76, textAlign: 'center', padding: 0 }} />
                <button type="button" aria-label="One more" onClick={() => setTimes(Math.min(600, times + 1))} style={stepBtn}>+</button>
                <span style={{ flex: 1, fontSize: 'var(--step--1)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
                  {times === 1 ? 'once' : `${times} times`}{last ? `, the last on ${friendlyDay(last, iso)}` : ''}
                </span>
              </div>
            )}
            {ends === 'on' && (
              <>
                <DateChips value={untilDate || addMonths(iso, 12)} today={iso} dir="future" min={iso} label="Last day"
                  quick={later.map(([n, text]) => ({ iso: addMonths(iso, n), label: text }))}
                  onChange={setUntilDate} />
                <input type="hidden" name="untilDate" value={untilDate || addMonths(iso, 12)} />
                <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.4, color: 'var(--c-meta)' }}>
                  {last ? `The last is ${friendlyDay(last, iso)}.` : 'None before then.'}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
          {kind === 'income' ? 'How it comes in' : 'How it is paid'}
        </span>
        <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
      </div>
      <CategoryPick name="categoryId" categories={offered}
        label={kind === 'income' ? 'What for' : 'Category'}
        placeholder={offered.length ? 'Choose a category' : 'No categories for this yet'} />

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

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 };
const rowLabel: React.CSSProperties = {
  width: 74, flex: 'none', fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)',
};
const stepBtn: React.CSSProperties = {
  width: 44, height: 44, flex: 'none', borderRadius: 999, background: 'var(--c-sunk2)',
  color: 'var(--c-ink)', fontSize: 'var(--step-1)', fontWeight: 600,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
/** The same day n months on, or the month's last day when it has no such day. */
function addMonths(iso: string, n: number) {
  const { y, m, d } = civil(iso);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

const select: React.CSSProperties = {
  minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
  background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
  fontWeight: 600, padding: '0 12px',
};
