'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from './haptics';

/* The two ways back that are not the arrow in the header.

   Both exist because of the founding decision to be a PWA. Installed to the
   home screen the app runs standalone — no browser chrome, no address bar,
   and on iOS no back gesture either, because the gesture belongs to Safari's
   UI and that UI is gone. So the one navigation move everybody already knows
   simply is not there, and the only way out of a screen was a 44px target in
   the far top-left, which is the hardest place on a phone to reach — and,
   once you have scrolled, not on the screen at all.

   1. A swipe from the left edge. Invisible, so it can never be the only way.
   2. A pill that floats in at the top-left the moment the header's arrow
      scrolls out of view, and leaves the moment it comes back. It is not
      there at the top of a screen, where the arrow already is, and it is not
      there at all until the arrow has gone — a second Back beside the first
      would be a control to wonder about. It takes the arrow's own corner:
      Back has lived top-left in every convention the phone has, so the eye
      goes there without being told, and the pill reads as the arrow having
      followed you down the page rather than as a new control. The bottom
      corners belong to the tab bar and the Add button; a third floating
      thing down there was one too many.

   Both do exactly what the visible arrow does and go to the same place. A
   gesture that does something the screen does not also offer is a gesture
   nobody discovers.

   SECURITY: `to` is only ever a literal written into a page by us, and it is
   still validated here before use. A destination that could be influenced by
   a query string or a referrer would turn a swipe into an open redirect —
   one flick and you are on somebody else's origin, having "gone back". */

// Same-origin, absolute, and not protocol-relative («//evil.example»).
const safe = (to: string) => to.startsWith('/') && !to.startsWith('//') && !to.includes('\\');

const EDGE = 28;      // where a back swipe may begin, in px from the left
const TRAVEL = 72;    // how far it must go to count
const SLOPE = 1.4;    // and how much more horizontal than vertical it must be

/* A swipe that starts on something scrollable belongs to that thing — the
   six-month bar chart and the month strip both scroll sideways, and stealing
   the first 28px of them would make them feel broken. */
function overScroller(node: EventTarget | null): boolean {
  let el = node as HTMLElement | null;
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 4) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

export default function Back({ to }: { to: string }) {
  const router = useRouter();
  /* null while the header's own arrow is on screen. Set from the observer,
     never in the effect body, so the first paint — server and client alike —
     has no pill and nothing to hydrate differently. */
  const [floating, setFloating] = useState<null | { below: number }>(null);

  useEffect(() => {
    if (!safe(to)) return;
    // Nothing to go back to, and no pointer that could do it anyway.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    let sx = 0, sy = 0, live = false;

    const start = (e: TouchEvent) => {
      live = false;
      if (e.touches.length !== 1) return;              // a pinch is not a swipe
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      if (overScroller(e.target)) return;
      sx = t.clientX; sy = t.clientY; live = true;
    };

    const end = (e: TouchEvent) => {
      if (!live) return;
      live = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = Math.abs(t.clientY - sy);
      if (dx < TRAVEL || dx < dy * SLOPE) return;
      // The same motion the Back arrow produces, so the gesture and the
      // button are visibly the same move — and a tick to say it took.
      haptic('select');
      router.push(to, { transitionTypes: ['nav-back'] });
    };

    // Passive: this never calls preventDefault, so it cannot make scrolling
    // wait on a JS frame. The browser is told so up front.
    const opts = { passive: true } as const;
    document.addEventListener('touchstart', start, opts);
    document.addEventListener('touchend', end, opts);
    document.addEventListener('touchcancel', () => { live = false; }, opts);
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchend', end);
    };
  }, [to, router]);

  useEffect(() => {
    if (!safe(to)) return;
    // The header's arrow — every screen with a way back draws one — and
    // not this pill, which carries the same label for the same reason.
    const arrow = document.querySelector<HTMLElement>('main a[aria-label="Back"]:not([data-floating])');
    if (!arrow) return;
    // A screen with a bar pinned to the top (the budget's running total)
    // marks it data-topbar, and the pill sits under that instead of on it.
    // Measured when the pill is about to appear, which is when the bar is
    // stuck and its bottom edge is where it will stay.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setFloating(null); return; }
      const bar = document.querySelector<HTMLElement>('main [data-topbar]');
      setFloating({ below: bar ? Math.max(0, bar.getBoundingClientRect().bottom) : 0 });
    });
    io.observe(arrow);
    return () => io.disconnect();
  }, [to]);

  const shown = floating !== null;
  return (
    <Link href={safe(to) ? to : '/'} transitionTypes={['nav-back']} className="el2 press"
      aria-label="Back" aria-hidden={!shown} tabIndex={shown ? 0 : -1} draggable={false} data-floating
      style={{
        position: 'fixed', zIndex: 34,
        left: 'max(14px, env(safe-area-inset-left, 0px))',
        top: floating?.below
          ? `${floating.below + 10}px`
          : 'calc(env(safe-area-inset-top, 0px) + 12px)',
        minHeight: 44, padding: '0 16px 0 11px', borderRadius: 999,
        display: 'flex', alignItems: 'center', gap: 5,
        background: 'var(--c-card)', color: 'var(--c-ink)',
        border: '1px solid var(--c-border)', textDecoration: 'none',
        fontSize: 'var(--step--1)', fontWeight: 600,
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(-10px)',
        pointerEvents: shown ? 'auto' : 'none',
        transition: 'opacity .18s ease, transform .22s cubic-bezier(.2,.8,.2,1)',
      }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Back
    </Link>
  );
}
