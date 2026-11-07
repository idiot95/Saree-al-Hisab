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

   Press. A phone paints :active on touch only around the finger lifting, 30–60ms late and after any scroll has had
   its say. `data-pressed` goes on at pointerdown, so `.press` (globals.css) and the dim below are drawn in the next
   frame; it comes off when the finger lifts, leaves, or turns the touch into a scroll or a swipe. */
const SLOP = 10; // px a finger may wander before the press is a drag

export default function NavLink({ prefetch, motion = 'push', onPointerDown, onClick, className, ...rest }:
  ComponentProps<typeof Link> & { motion?: Motion }) {
  const press = (e: PointerEvent<HTMLAnchorElement>) => {
    onPointerDown?.(e);
    if (e.button !== 0 || e.defaultPrevented) return;
    const el = e.currentTarget;
    const x = e.clientX, y = e.clientY;
    el.setAttribute('data-pressed', '');
    const off = () => {
      el.removeAttribute('data-pressed');
      removeEventListener('pointerup', off, true);
      removeEventListener('pointercancel', off, true);
      removeEventListener('pointermove', drift, true);
      removeEventListener('scroll', off, true);
      el.removeEventListener('pointerleave', off);
    };
    const drift = (m: globalThis.PointerEvent) => { if (Math.abs(m.clientX - x) > SLOP || Math.abs(m.clientY - y) > SLOP) off(); };
    addEventListener('pointerup', off, true);
    addEventListener('pointercancel', off, true);
    addEventListener('pointermove', drift, { capture: true, passive: true });
    addEventListener('scroll', off, { capture: true, passive: true });
    el.addEventListener('pointerleave', off);
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
