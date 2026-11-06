'use client';

import { useCallback, useState } from 'react';
import BottomDrawer from './BottomDrawer';
import HijriCalendar, { civil } from './HijriCalendar';
import { haptic } from './haptics';
import { choice } from './choice';
import { formatHijri, toHijri } from '@/lib/hijri';
import { friendlyDay, shiftDay } from '@/lib/recur';

/* Picking a day, the way a thumb wants to: the likely days are chips in a
   row — Today, Yesterday, the few before — and any other day is one tap
   further, on a month grid that reads the way the calendar on the Scheduled
   screen does, English day and Hijri day together. The value is always a
   plain YYYY-MM-DD; the words are for the person. Nothing here is a native
   date box: that one is a different control on every phone, hides the
   weekday, and asks for a year nobody is changing. */


/** A row of quick days plus "Another day", which opens the grid. `from` is
 *  where the quick days start, and `dir` which way they run — back from
 *  today for something that happened, on from a due date for a move. The
 *  row wraps rather than scrolls, so every chip — "Another day" above all —
 *  is in view without a swipe. */
export function DateChips({ value, onChange, today, from = today, dir, min, max, count = 4, label, quick }: {
  value: string; onChange: (iso: string) => void; today: string;
  from?: string; dir: 'past' | 'future'; min?: string; max?: string; count?: number;
  /** What the grid's drawer is called: "Which day was it". */
  label: string;
  /** Named days instead of the run — "In a year" — for an end that is far off. */
  quick?: { iso: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const within = (iso: string) => (!min || iso >= min) && (!max || iso <= max);
  const run = quick
    ? quick.filter((q) => within(q.iso))
    : Array.from({ length: count }, (_, i) => shiftDay(from, dir === 'past' ? -i : i + 1))
        .filter(within).map((iso) => ({ iso, label: friendlyDay(iso, today) }));
  // A day picked from the grid takes the first seat, so the row always shows
  // what is chosen.
  const chips = run.some((q) => q.iso === value) ? run : [{ iso: value, label: friendlyDay(value, today) }, ...run];

  const pick = (iso: string) => { haptic('select'); onChange(iso); };

  return (
    <>
      <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((q) => {
          const on = q.iso === value;
          return (
            <button key={q.iso} type="button" role="radio" aria-checked={on} onClick={() => pick(q.iso)}
              style={{ ...chip, ...choice(on) }}>
              {q.label}
            </button>
          );
        })}
        <button type="button" onClick={() => { haptic('tap'); setOpen(true); }} style={{
          ...chip, background: 'transparent', color: 'var(--muted-foreground)', border: '1px dashed var(--input)',
        }}>
          Another day…
        </button>
      </div>
      <DateSheet open={open} onClose={close} label={label} value={value} today={today} min={min} max={max}
        onPick={(iso) => { onChange(iso); close(); }} />
    </>
  );
}

/** The month grid in a drawer. Days outside min–max are shown but not offered. Opened from inside another drawer
 *  (Money back) it nests, so the one behind stays put. */
export function DateSheet({ open, onClose, label, value, today, min, max, onPick }: {
  open: boolean; onClose: () => void; label: string; value: string; today: string;
  min?: string; max?: string; onPick: (iso: string) => void;
}) {
  return (
    <BottomDrawer open={open} onClose={onClose} label={label} showTitle repositionInputs={false}>
      <MonthGrid value={value} today={today} min={min} max={max} onPick={(iso) => { haptic('select'); onPick(iso); }} />
      <p className="mt-2.5 mb-1 text-xs leading-snug text-muted-foreground">
        Chosen: {friendlyDay(value, today)} · {formatHijri(toHijri(civil(value)), true)}
      </p>
    </BottomDrawer>
  );
}

/** One month at a time, Monday first, each day wearing its Hijri day: shadcn's Calendar with a Hijri day button. */
export function MonthGrid({ value, today, min, max, onPick }: {
  value: string; today: string; min?: string; max?: string; onPick: (iso: string) => void;
}) {
  const [month, setMonth] = useState(() => { const c = civil(value); return new Date(c.y, c.m - 1, 1); });
  return <HijriCalendar month={month} onMonthChange={setMonth} today={today} selected={value} min={min} max={max} onPick={onPick} />;
}

/** A day of the month, 1 to `top`, as a grid of taps — for a rule, where
 *  the month is "every one" and a weekday means nothing. */
export function DayOfMonth({ value, top, onPick, label = 'Day of the month' }: {
  value: number; top: number; onPick: (d: number) => void; label?: string;
}) {
  // As many 44px columns as fit (seven on most phones, fewer on the narrowest): a weekday means nothing here.
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4 }}>
      {Array.from({ length: top }, (_, i) => i + 1).map((d) => {
        const on = d === value;
        return (
          <button key={d} type="button" role="radio" aria-checked={on} onClick={() => { haptic('select'); onPick(d); }}
            className="t" style={{
              minHeight: 44, borderRadius: 10, textAlign: 'center', fontSize: 'var(--step-0)', fontWeight: on ? 700 : 500,
              background: on ? 'var(--primary)' : 'var(--background)',
              color: on ? 'var(--primary-foreground)' : 'var(--foreground)',
            }}>
            {d}
          </button>
        );
      })}
    </div>
  );
}

/** Twelve months as a grid of taps, in whichever calendar's names. */
export function MonthOfYear({ value, names, onPick, label = 'Month' }: {
  value: number; names: readonly string[]; onPick: (m: number) => void; label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
      {names.map((name, i) => {
        const on = i + 1 === value;
        return (
          <button key={name} type="button" role="radio" aria-checked={on} onClick={() => { haptic('select'); onPick(i + 1); }} style={{
            minHeight: 44, borderRadius: 10, padding: '0 4px', textAlign: 'center', fontSize: 'var(--step--1)', fontWeight: on ? 700 : 600,
            lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            background: on ? 'var(--primary)' : 'var(--background)',
            color: on ? 'var(--primary-foreground)' : 'var(--foreground)',
          }}>
            {name}
          </button>
        );
      })}
    </div>
  );
}

/** A two-way pill — "Every month | Once a year" — that is also a radio
 *  group with a form name, so the server reads it like any other field. */
export function Segmented<T extends string>({ name, value, options, onChange, label }: {
  name: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{
      display: 'flex', gap: 3, padding: 3, background: 'var(--muted)', borderRadius: 999, flex: 1, minWidth: 0,
    }}>
      {options.map(([id, text]) => {
        const on = value === id;
        return (
          <label key={id} style={{
            position: 'relative', flex: 1, minHeight: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 999, cursor: 'pointer', padding: '0 6px',
            fontSize: 'var(--step--1)', fontWeight: 600, textAlign: 'center', lineHeight: 1.15,
            background: on ? 'var(--card)' : 'transparent',
            color: on ? 'var(--foreground)' : 'var(--muted-foreground)',
            boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : undefined,
          }}>
            <input type="radio" name={name} value={id} checked={on} onChange={() => { haptic('select'); onChange(id); }}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} />
            {text}
          </label>
        );
      })}
    </div>
  );
}

const chip: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', flex: 'none',
  borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600, whiteSpace: 'nowrap',
  transition: 'background .15s, color .15s',
};
