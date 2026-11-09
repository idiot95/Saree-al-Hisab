'use client';

import { Component, lazy, Suspense, useEffect, type ComponentProps, type ReactNode } from 'react';
import type HijriCalendarType from './HijriCalendar';
import { MONTHS, hijriSpan } from './calendar-dates';
import { haptic } from './haptics';

/* The month grid, loaded when it is wanted (v3.1 P5, perf row 9). HijriCalendar pulls in react-day-picker, about
   26KB gz / 85KB raw, and every month grid in the app opens on a tap — the date drawer, Add's When, Upcoming's
   folded month — so no route's first load pays for it: not Home, Activity or Add (whose drawer is in the root layout).

   No visible wait (P5 fix round 1, review I3): a screen that can open a grid starts the import in idle time once it
   has mounted (`useCalendarSoon`: Add's When row, the date chips, Upcoming's month), so on a slow phone the module is
   parsed before the tap; the press starts it too (`opensCalendar`), for a tap quicker than idle. Until the grid draws,
   its room holds a still drawing of the same month (`GridGhost`: the caption, the weekdays and the day numbers, no
   react-day-picker) at the grid's exact height, so the drawer slides in with the month already on it.

   Without signal (review I2): a failed import is not kept (the next ask tries again), and the grid's own boundary
   says so in the grid's room with Try again — the drawer, the chips above it and everything typed stay. Once the
   chunk has been fetched the worker's asset cache holds it, so this is the first-ever-open-offline case. The offline
   page bundles the module and primes the loader (`primeCalendar`). */

type Mod = typeof import('./HijriCalendar');
let mod: Promise<Mod> | null = null;
/* The module once it is here. React.lazy suspends on its first render even when the import has long finished, which
   drew the ghost for a frame on a tap after the idle preload; a loaded module is drawn directly instead. */
let loaded: Mod | null = null;

/** Start loading the grid (idempotent while it succeeds; a failure is forgotten so the next call retries). */
export function preloadCalendar(): Promise<Mod> {
  mod ??= import('./HijriCalendar').then(
    (m) => { loaded = m; return m; },
    (e: unknown) => { mod = null; throw e; });
  return mod;
}

/** Hand the loader a module already in this bundle (the offline page), so it never fetches. */
export function primeCalendar(m: Mod) {
  loaded ??= m;
  mod ??= Promise.resolve(m);
}

const warm = () => { preloadCalendar().catch(() => { /* asked again on open */ }); };

/** What an opener spreads: the import starts on the press, not on the click that follows it. */
export const opensCalendar = { onPointerDown: warm, onFocus: warm };

/** For a component that can open a grid: load it in idle time once mounted (a timeout where there is no
 *  requestIdleCallback — Safari), so the tap finds it parsed. */
export function useCalendarSoon() {
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 1000);
    return () => clearTimeout(id);
  }, []);
}

/* React.lazy keeps a rejected load for good, so a failed one is replaced by a fresh lazy on Try again. */
let Grid = lazy(preloadCalendar);

type Props = ComponentProps<typeof HijriCalendarType>;

/** Mondays-first weeks the month spans: the grid's height. */
function weeksIn(first: Date) {
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Math.ceil((lead + days) / 7);
}

/* The grid's own box: the caption (a cell tall) and its 8px gap, the 18px weekday line, and a row per week with its
   2px gap — a cell tall, or 45px where the day's two lines are taller than a 44px cell (measured, iPhone 393 and
   Pixel 7). The same variables the grid sets, so Android's 48px cells are held too. */
const BOX = 'w-full [--cell-size:44px] in-data-[platform=android]:[--cell-size:48px]';
const boxHeight = (weeks: number) => `calc(var(--cell-size) + 26px + ${weeks} * (max(var(--cell-size), 45px) + 2px))`;
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** The month as the grid will draw it, still: caption, weekdays, the day numbers in their columns. */
function GridGhost({ month, className }: { month: Date; className?: string }) {
  const weeks = weeksIn(month);
  const lead = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return (
    <div aria-busy="true" aria-label="Loading the month" data-calendar-ghost=""
      className={`${BOX} flex flex-col gap-2 overflow-hidden ${className ?? ''}`} style={{ height: boxHeight(weeks) }}>
      <div className="flex min-h-(--cell-size) flex-col items-center justify-center">
        <span className="text-headline font-semibold text-foreground">{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
        <span className="text-footnote text-muted-foreground">{hijriSpan(month.getFullYear(), month.getMonth() + 1)}</span>
      </div>
      <div>
        <div className="flex">
          {WEEKDAYS.map((d) => <span key={d} className="flex-1 pb-0.5 text-center text-footnote font-semibold text-muted-foreground">{d}</span>)}
        </div>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="mt-0.5 flex w-full">
            {Array.from({ length: 7 }, (_, c) => {
              const d = w * 7 + c - lead + 1;
              return (
                <span key={c} className="flex min-h-[max(var(--cell-size),45px)] flex-1 items-start justify-center pt-1.5 text-headline font-medium leading-none tabular-nums text-muted-foreground/60">
                  {d >= 1 && d <= days ? d : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Keeps a failed load inside the grid's room: a line and Try again, never the route's error screen. */
class GridBoundary extends Component<{ month: Date; className?: string; grid: () => ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  retry = () => {
    haptic('tap');
    Grid = lazy(preloadCalendar);
    this.setState({ failed: false });
  };
  render() {
    // `grid` is called here, so after Try again it draws the fresh lazy, not the one that failed.
    if (!this.state.failed) return this.props.grid();
    return (
      <div role="alert" data-calendar-failed="" className={`${BOX} flex flex-col items-center justify-center gap-2 px-4 text-center ${this.props.className ?? ''}`}
        style={{ height: boxHeight(weeksIn(this.props.month)) }}>
        <p className="text-body text-muted-foreground">The month needs a signal to open. Pick a day above, or try again.</p>
        <button type="button" onClick={this.retry}
          className="press min-h-11 rounded-full px-4 text-body font-semibold text-primary in-data-[platform=android]:min-h-12">
          Try again
        </button>
      </div>
    );
  }
}

export default function HijriCalendar(props: Props) {
  return (
    <GridBoundary month={props.month} className={props.className} grid={() => {
      if (loaded) { const Loaded = loaded.default; return <Loaded {...props} />; }
      return (
        <Suspense fallback={<GridGhost month={props.month} className={props.className} />}>
          <Grid {...props} />
        </Suspense>
      );
    }} />
  );
}
