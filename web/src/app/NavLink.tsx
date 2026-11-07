'use client';

import Link from 'next/link';
import { type ComponentProps, type PointerEvent } from 'react';
import { startPending, type Motion } from './pending';

/* Every link in the app: press feedback under the finger, the destination's frame on the tap, and no prefetch
   unless the link asks for one.

   Prefetch. Next prefetches a <Link> as it scrolls into view and again whenever a Server Action revalidates, and
   every screen here is rendered per request from a household's books, so a list of entries prefetched itself into
   about a hundred server renders a second. Prefetching on intent (a finger coming down) was tried next and was pure
   cost: the click followed about 100ms later, long before the prefetch returned, so each tap made three server
   renders (perf-findings.md §3). So a link does not prefetch at all, and the handful that are tapped all day — the
   five tabs and Home's four doors (household, the month card, net worth, owed to you) — pass `prefetch`, which
   fetches the whole screen as the link comes into view: the tap then costs no server render and the screen is
   already on the phone. `prefetch="auto"` (only down to the loading frame) was measured and was worse here: the
   frame committed first and React then held the content for its 300ms reveal throttle (p2-report.md). Whole
   prefetches go stale after 30s like any visited screen (next.config `staleTimes`), and every write empties them.
   Rows never prefetch.

   `motion` is how the destination comes on (pending.ts): `push` deeper, `pop` back out, `fade` sideways from Home,
   `tab-left`/`tab-right` between tabs. It replaces the old `transitionTypes`, which started a view transition that
   held the new screen's content back until its animation ended.

   Press. A phone paints :active on touch only around the finger lifting, 30–60ms late. So `data-pressed` (which
   `.press` in globals.css and the dim below draw) is set by hand, ARM_MS after the finger lands (counted in frames) if it has stayed
   put — so a touch that is the start of a scroll is never drawn as a press. A finger that has moved more than
   STILL before then is not yet a press: it is drawn only if it lifts as a tap. Past SLOP, a pointercancel (the
   browser has taken the touch for a scroll), a scroll or a leave, it is not a press at all. A finger that lifts
   before ARM_MS is a quick tap: the press is drawn on the lift. Either way it stays HOLD_MS after the lift, so it is
   seen, and is still there as the frame comes in. */
const STILL = 3;     // px a finger may wobble before the press waits for the lift
const SLOP = 10;     // px a finger may wander before the touch is a drag, not a press
const ARM_MS = 50;   // how long a still touch takes to be drawn as a press
const HOLD_MS = 100; // how long a press stays drawn after the lift

export default function NavLink({ prefetch, motion = 'push', pressNow = false, onPointerDown, onClick, className, ...rest }:
  ComponentProps<typeof Link> & {
    motion?: Motion;
    /** Draw the press as the finger lands, with no wait: for links nothing can scroll under (the tab bar). */
    pressNow?: boolean;
  }) {
  const press = (e: PointerEvent<HTMLAnchorElement>) => {
    onPointerDown?.(e);
    if (e.button !== 0 || e.defaultPrevented) return;
    const el = e.currentTarget;
    const x = e.clientX, y = e.clientY;
    const on = () => el.setAttribute('data-pressed', '');
    let armed = false;
    /* Counted on animation frames, not a timer: Chrome holds timers back for about 100ms after a touchstart (it
       keeps that time for scrolling), so a 50ms timeout fires late, after the finger has lifted. */
    const t0 = performance.now();
    let frame = 0;
    const tick = () => {
      if (performance.now() - t0 >= ARM_MS) { armed = true; on(); return; }
      frame = requestAnimationFrame(tick);
    };
    const stopArming = () => cancelAnimationFrame(frame);
    if (pressNow) { armed = true; on(); } else frame = requestAnimationFrame(tick);
    const done = () => {
      stopArming();
      removeEventListener('pointerup', up, true);
      removeEventListener('pointercancel', cancel, true);
      removeEventListener('pointermove', drift, true);
      removeEventListener('scroll', cancel, true);
      el.removeEventListener('pointerleave', cancel);
    };
    // Not a press after all: never drawn, or taken back.
    const cancel = () => { done(); el.removeAttribute('data-pressed'); };
    // Lifted as a tap: the press is drawn (if it was not yet) and stays HOLD_MS, so even a quick tap's is seen and
    // it is still there as the frame comes in.
    const up = () => {
      done();
      on();
      setTimeout(() => el.removeAttribute('data-pressed'), HOLD_MS);
    };
    const drift = (m: globalThis.PointerEvent) => {
      const d = Math.max(Math.abs(m.clientX - x), Math.abs(m.clientY - y));
      if (d > SLOP) cancel();
      else if (d > STILL && !armed) stopArming(); // moving: drawn only if it lifts as a tap
    };
    addEventListener('pointerup', up, true);
    addEventListener('pointercancel', cancel, true);
    addEventListener('pointermove', drift, { capture: true, passive: true });
    addEventListener('scroll', cancel, { capture: true, passive: true });
    el.addEventListener('pointerleave', cancel);
  };
  return (
    <Link
      {...rest}
      prefetch={prefetch ?? false}
      onPointerDown={press}
      /* A dim under the finger for links with no press of their own (rows, text links), instant both ways. */
      className={className ? `${className} data-pressed:opacity-75` : 'data-pressed:opacity-75'}
      onClick={(e) => {
        onClick?.(e);
        /* A plain tap on a link that goes somewhere of ours draws that screen's frame at once. Not a click the
           handler above took over (Back steps through history itself), not a new tab or a modified click. */
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (rest.target === '_blank' || typeof rest.href !== 'string') return;
        startPending(rest.href, motion);
      }}
    />
  );
}
