'use client';

import { lazy, Suspense, type ComponentProps } from 'react';
import type HijriCalendarType from './HijriCalendar';

/* The month grid, loaded when it is wanted (v3.1 P5, perf row 9). HijriCalendar pulls in react-day-picker, about
   26KB gz / 85KB raw, and every month grid in the app opens on a tap — the date drawer, Add's When, Upcoming's
   folded month — so nothing pays for it on load: not Home, Activity or Add (whose drawer is in the root layout).

   No visible wait: whatever opens a grid starts the import as the finger lands or focus arrives (`preloadCalendar`
   on the opener, `onPointerDown`/`onFocus`), the drawer is drawn at once, and the grid's room is held by a block of
   the same height until it lands — usually before the drawer has finished sliding in. One import, shared: a second
   opener finds it done. The offline page primes it (`primeCalendar`) with the module itself, so a phone with no
   signal never asks for a chunk the worker did not keep. */

type Mod = typeof import('./HijriCalendar');
let mod: Promise<Mod> | null = null;

/** Start loading the grid (idempotent). For an opener's onPointerDown / onFocus. */
export function preloadCalendar(): Promise<Mod> {
  mod ??= import('./HijriCalendar');
  return mod;
}

/** Hand the loader a module already in this bundle (the offline page), so it never fetches. */
export function primeCalendar(m: Mod) {
  mod ??= Promise.resolve(m);
}

/** What an opener spreads: the import starts on the press, not on the click that follows it. */
export const opensCalendar = { onPointerDown: () => { void preloadCalendar(); }, onFocus: () => { void preloadCalendar(); } };

const Grid = lazy(preloadCalendar);

type Props = ComponentProps<typeof HijriCalendarType>;

/** Mondays-first weeks the month spans: the grid's height. */
function weeksIn(first: Date) {
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return Math.ceil((lead + days) / 7);
}

export default function HijriCalendar(props: Props) {
  /* The grid's own box while it loads: the caption (a cell tall) and its 8px gap, the 18px weekday line, and a row
     per week with its 2px gap — a cell tall, or 45px where the day's two lines are taller than a 44px cell (measured,
     iPhone 393 and Pixel 7). The same variables the grid sets, so Android's 48px cells are held too. */
  const weeks = weeksIn(props.month);
  const room = (
    <div aria-busy="true" className={`w-full [--cell-size:44px] in-data-[platform=android]:[--cell-size:48px] ${props.className ?? ''}`}
      style={{ height: `calc(var(--cell-size) + 26px + ${weeks} * (max(var(--cell-size), 45px) + 2px))` }} />
  );
  return <Suspense fallback={room}><Grid {...props} /></Suspense>;
}
