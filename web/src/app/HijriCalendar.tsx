'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import type { DayButton, MonthCaption } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { HIJRI_MONTHS_SHORT, formatHijri, toHijri } from '@/lib/hijri';
import { cn } from '@/lib/utils';

/* One month on shadcn's Calendar (react-day-picker), the way this house reads a month: Monday first, each English
   day wearing its Hijri day underneath, the 1st of a Hijri month naming it, and the Hijri months the page spans
   under the month's name. Used by the date picker (one day chosen, bounded by min/max) and by Upcoming's month of
   schedules (no selection; each day may carry marks). Dates go in and out as plain YYYY-MM-DD; the Date objects
   react-day-picker wants are local midnights made here, so nothing shifts across a time zone.

   Cells are 44px tall at least (48 on Android) and a seventh of the width with no gaps between, which is 44px or more
   from a 360px screen up: in a drawer the grid has the drawer's width less its gutters, and Upcoming's card lets it
   run into its own padding (its className). */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
export const civil = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
export const dateOf = (iso: string) => { const c = civil(iso); return new Date(c.y, c.m - 1, c.d); };
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "Rabi II – Jumada I 1448": the Hijri months a Gregorian month spans. */
export function hijriSpan(y: number, m: number) {
  const days = new Date(y, m, 0).getDate();
  const a = toHijri({ y, m, d: 1 }), b = toHijri({ y, m, d: days });
  const A = HIJRI_MONTHS_SHORT[a.m - 1], B = HIJRI_MONTHS_SHORT[b.m - 1];
  if (a.m === b.m && a.y === b.y) return `${A} ${a.y}`;
  return a.y === b.y ? `${A} – ${B} ${a.y}` : `${A} ${a.y} – ${B} ${b.y}`;
}

/** What a day carries beyond its dates: words for its label, marks drawn under it, and a ground when it is busy. */
export type DayMarks = { label?: string; marks?: React.ReactNode; busy?: boolean };

export default function HijriCalendar({ month, onMonthChange, today, selected, onPick, min, max, marksFor, className }: {
  /** The first of the month shown (controlled). */
  month: Date; onMonthChange: (first: Date) => void;
  today: string; onPick: (iso: string) => void;
  /** The chosen day, for a picker. Absent for a calendar that only opens days. */
  selected?: string;
  /** Days outside min–max are shown but not offered, and paging stops at their months. */
  min?: string; max?: string;
  marksFor?: (iso: string) => DayMarks | undefined;
  className?: string;
}) {
  const disabled = [
    ...(min ? [{ before: dateOf(min) }] : []),
    ...(max ? [{ after: dateOf(max) }] : []),
  ];
  const pick = (d: Date | undefined) => { if (d) onPick(isoOf(d)); };
  const shared = {
    month, onMonthChange, weekStartsOn: 1 as const, showOutsideDays: false, today: dateOf(today),
    startMonth: min ? dateOf(min) : undefined, endMonth: max ? dateOf(max) : undefined,
    disabled: disabled.length ? disabled : undefined,
    labels: {
      labelGrid: (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      labelPrevious: () => 'Previous month',
      labelNext: () => 'Next month',
      labelDayButton: (d: Date) => {
        const iso = isoOf(d);
        const extra = marksFor?.(iso)?.label;
        return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${formatHijri(toHijri(civil(iso)), true)}${extra ? `, ${extra}` : ''}`;
      },
    },
    formatters: { formatCaption: (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}` },
    components: {
      MonthCaption: Caption,
      DayButton: HijriDay,
    },
    className: cn('w-full bg-transparent p-0 [--cell-size:44px] in-data-[platform=android]:[--cell-size:48px]', className),
    classNames: {
      root: '',
      months: 'relative flex flex-col',
      month: 'flex w-full flex-col gap-2',
      month_caption: 'flex min-h-(--cell-size) w-full flex-col items-center justify-center px-(--cell-size)',
      caption_label: 'text-headline font-semibold text-foreground',
      weekdays: 'flex',
      weekday: 'flex-1 pb-0.5 text-center text-footnote font-semibold text-muted-foreground select-none',
      week: 'mt-0.5 flex w-full',
      day: 'relative flex-1 p-0 text-center select-none',
      today: '', outside: '', disabled: '', hidden: 'invisible',
    },
  };
  return (
    <Marks.Provider value={marksFor}>
      {selected !== undefined
        ? <Calendar mode="single" required selected={dateOf(selected)} onSelect={pick} {...shared} />
        : <Calendar onDayClick={pick} {...shared} />}
    </Marks.Provider>
  );
}

function Caption({ calendarMonth, displayIndex, className, children, ...props }: React.ComponentProps<typeof MonthCaption>) {
  void displayIndex;
  const d = calendarMonth.date;
  return (
    <div className={className} {...props}>
      {children}
      <span className="text-footnote text-muted-foreground">{hijriSpan(d.getFullYear(), d.getMonth() + 1)}</span>
    </div>
  );
}

/* The day's marks come through context, so DayButton stays one stable component and a re-render does not remount
   every button (which would drop the keyboard's place in the grid). */
const Marks = createContext<((iso: string) => DayMarks | undefined) | undefined>(undefined);

function HijriDay({ day, modifiers, className, children, ...props }: React.ComponentProps<typeof DayButton>) {
  void children; void className;
  const marks = useContext(Marks)?.(isoOf(day.date));
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (modifiers.focused) ref.current?.focus(); }, [modifiers.focused]);
  const h = toHijri(civil(isoOf(day.date)));
  const on = !!modifiers.selected;
  const first = h.d === 1;
  return (
    <button ref={ref} {...props} data-selected={on || undefined} data-today={modifiers.today || undefined}
      className={cn(
        'flex min-h-(--cell-size) w-full flex-col items-center justify-center gap-0.5 rounded-[10px] px-0 py-1.5 text-foreground outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 aria-disabled:opacity-30',
        marks?.busy && 'bg-muted',
        on && 'bg-primary text-primary-foreground',
        modifiers.today && !on && 'ring-2 ring-chart-1 ring-inset',
      )}>
      <span className={cn('tabular-nums text-headline leading-none', modifiers.today || on ? 'font-bold' : 'font-medium')}>
        {day.date.getDate()}
      </span>
      {/* The 1st names its Hijri month whole ("Jumada II", "Zilqadah"): on one line, a size smaller, rather than
          wrapping to a second line or being cut short. */}
      <span className={cn('leading-none',
        first ? 'whitespace-nowrap text-caption font-bold tracking-[-0.04em]' : 'text-caption font-medium',
        on ? 'text-primary-foreground/85' : first ? 'text-primary' : 'text-muted-foreground')}>
        {first ? HIJRI_MONTHS_SHORT[h.m - 1] : h.d}
      </span>
      {marks?.marks !== undefined && <span className="flex min-h-1.5 items-center gap-[3px]">{marks.marks}</span>}
    </button>
  );
}
