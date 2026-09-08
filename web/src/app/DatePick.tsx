'use client';

import { useCallback, useState } from 'react';
import Sheet from './Sheet';
import { haptic } from './haptics';
import { HIJRI_MONTHS_SHORT, formatHijri, toHijri } from '@/lib/hijri';
import { friendlyDay, shiftDay } from '@/lib/recur';

/* Picking a day, the way a thumb wants to: the likely days are chips in a
   row — Today, Yesterday, the few before — and any other day is one tap
   further, on a month grid that reads the way the calendar on the Scheduled
   screen does, English day and Hijri day together. The value is always a
   plain YYYY-MM-DD; the words are for the person. Nothing here is a native
   date box: that one is a different control on every phone, hides the
   weekday, and asks for a year nobody is changing. */

const pad = (n: number) => String(n).padStart(2, '0');
const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

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
            <button key={q.iso} type="button" role="radio" aria-checked={on} onClick={() => pick(q.iso)} style={{
              ...chip, background: on ? 'var(--c-seagrass)' : 'var(--c-sunk2)',
              color: on ? 'var(--c-on-primary)' : 'var(--c-ink)',
            }}>
              {q.label}
            </button>
          );
        })}
        <button type="button" onClick={() => { haptic('tap'); setOpen(true); }} style={{
          ...chip, background: 'transparent', color: 'var(--c-teal)', border: '1px dashed var(--c-dash)',
        }}>
          Another day…
        </button>
      </div>
      <DateSheet open={open} onClose={close} label={label} value={value} today={today} min={min} max={max}
        onPick={(iso) => { onChange(iso); close(); }} />
    </>
  );
}

/** The month grid in a drawer. Days outside min–max are shown but not offered. */
export function DateSheet({ open, onClose, label, value, today, min, max, onPick }: {
  open: boolean; onClose: () => void; label: string; value: string; today: string;
  min?: string; max?: string; onPick: (iso: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={label}>
      <h3 style={{ margin: '0 0 8px', fontSize: 'var(--step-0)', fontWeight: 600 }}>{label}</h3>
      <MonthGrid value={value} today={today} min={min} max={max} onPick={(iso) => { haptic('select'); onPick(iso); }} />
      <p style={{ margin: '10px 0 4px', fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
        Chosen: {friendlyDay(value, today)} · {formatHijri(toHijri(civil(value)), true)}
      </p>
    </Sheet>
  );
}

/** One month at a time, Monday first, each day wearing its Hijri day. */
export function MonthGrid({ value, today, min, max, onPick }: {
  value: string; today: string; min?: string; max?: string; onPick: (iso: string) => void;
}) {
  const [{ y, m }, setYm] = useState(() => { const c = civil(value); return { y: c.y, m: c.m }; });
  const key = `${y}-${pad(m)}-`;
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const step = (n: number) => {
    const x = new Date(y, m - 1 + n, 1);
    setYm({ y: x.getFullYear(), m: x.getMonth() + 1 });
  };
  // Paging stops where the days do: no reason to show a month with nothing in it.
  const canBack = !min || `${key}01` > min;
  const canOn = !max || `${key}${pad(days)}` < max;
  const hijriSpan = (() => {
    const a = toHijri({ y, m, d: 1 }), b = toHijri({ y, m, d: days });
    const A = HIJRI_MONTHS_SHORT[a.m - 1], B = HIJRI_MONTHS_SHORT[b.m - 1];
    if (a.m === b.m && a.y === b.y) return `${A} ${a.y}`;
    return a.y === b.y ? `${A} – ${B} ${a.y}` : `${A} ${a.y} – ${B} ${b.y}`;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => step(-1)} disabled={!canBack} aria-label="Previous month"
          style={{ ...nav, opacity: canBack ? 1 : 0.3 }}>
          <Chevron d="M15 5l-7 7 7 7" />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{MONTHS[m - 1]} {y}</span>
          <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{hijriSpan}</span>
        </div>
        <button type="button" onClick={() => step(1)} disabled={!canOn} aria-label="Next month"
          style={{ ...nav, opacity: canOn ? 1 : 0.3 }}>
          <Chevron d="M9 5l7 7-7 7" />
        </button>
      </div>
      <div role="grid" aria-label={`${MONTHS[m - 1]} ${y}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DOW.map((d) => (
          <span key={d} role="columnheader" style={{
            textAlign: 'center', fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)', paddingBottom: 2,
          }}>{d}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const d = i + 1;
          const iso = `${key}${pad(d)}`;
          const h = toHijri({ y, m, d });
          const on = iso === value;
          const isToday = iso === today;
          const off = (!!min && iso < min) || (!!max && iso > max);
          return (
            <button key={iso} type="button" role="gridcell" aria-selected={on} disabled={off}
              aria-label={`${d} ${MONTHS[m - 1]}, ${formatHijri(h, true)}`} onClick={() => onPick(iso)} style={{
                minHeight: 50, borderRadius: 10, padding: '5px 0 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: on ? 'var(--c-seagrass)' : 'transparent',
                color: on ? 'var(--c-on-primary)' : 'var(--c-ink)',
                boxShadow: isToday && !on ? 'inset 0 0 0 2px var(--c-seagrass)' : undefined,
                opacity: off ? 0.3 : 1,
              }}>
              <span className="t" style={{ fontSize: 'var(--step-0)', lineHeight: 1, fontWeight: isToday || on ? 700 : 500 }}>{d}</span>
              <span style={{
                fontSize: '0.62rem', lineHeight: 1, fontWeight: h.d === 1 ? 700 : 500,
                color: on ? 'var(--c-on-primary)' : h.d === 1 ? 'var(--c-teal)' : 'var(--c-meta)',
                opacity: on ? 0.85 : 1,
              }}>
                {h.d === 1 ? HIJRI_MONTHS_SHORT[h.m - 1] : h.d}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A day of the month, 1 to `top`, as a grid of taps — for a rule, where
 *  the month is "every one" and a weekday means nothing. */
export function DayOfMonth({ value, top, onPick, label = 'Day of the month' }: {
  value: number; top: number; onPick: (d: number) => void; label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
      {Array.from({ length: top }, (_, i) => i + 1).map((d) => {
        const on = d === value;
        return (
          <button key={d} type="button" role="radio" aria-checked={on} onClick={() => { haptic('select'); onPick(d); }}
            className="t" style={{
              minHeight: 44, borderRadius: 10, textAlign: 'center', fontSize: 'var(--step-0)', fontWeight: on ? 700 : 500,
              background: on ? 'var(--c-seagrass)' : 'var(--c-sunk2)',
              color: on ? 'var(--c-on-primary)' : 'var(--c-ink)',
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
            background: on ? 'var(--c-seagrass)' : 'var(--c-sunk2)',
            color: on ? 'var(--c-on-primary)' : 'var(--c-ink)',
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
      display: 'flex', gap: 3, padding: 3, background: 'var(--c-sunk)', borderRadius: 999, flex: 1, minWidth: 0,
    }}>
      {options.map(([id, text]) => {
        const on = value === id;
        return (
          <label key={id} style={{
            position: 'relative', flex: 1, minHeight: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 999, cursor: 'pointer', padding: '0 6px',
            fontSize: 'var(--step--1)', fontWeight: 600, textAlign: 'center', lineHeight: 1.15,
            background: on ? 'var(--c-card)' : 'transparent',
            color: on ? 'var(--c-ink)' : 'var(--c-meta)',
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

function Chevron({ d }: { d: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
  );
}

const chip: React.CSSProperties = {
  minHeight: 44, padding: '0 14px', display: 'flex', alignItems: 'center', flex: 'none',
  borderRadius: 999, fontSize: 'var(--step--1)', fontWeight: 600, whiteSpace: 'nowrap',
  transition: 'background .15s, color .15s',
};

const nav: React.CSSProperties = {
  width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
  alignItems: 'center', justifyContent: 'center', background: 'transparent', color: 'var(--c-ink)',
};
