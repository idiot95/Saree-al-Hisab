'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from './haptics';

/* The way back that is not the arrow in the header: a swipe from the left
   edge.

   It exists because of the founding decision to be a PWA. Installed to the
   home screen the app runs standalone — no browser chrome, no address bar,
   and on iOS no back gesture either, because the gesture belongs to Safari's
   UI and that UI is gone. So the one navigation move everybody already knows
   simply is not there.

   There used to be a second thing here: a pill that floated in at the
   top-left once the header's arrow had scrolled away. It was removed. It
   solved a real problem — the arrow is unreachable once you have scrolled —
   but it solved it by putting a control on top of the page that was not part
   of any page, and it landed over content often enough to be its own
   nuisance. The swipe covers the same ground without drawing anything, and
   the arrow is one scroll away.

   The swipe is invisible, so it can never be the only way: it does exactly
   what the visible arrow does and goes to the same place. A gesture that
   does something the screen does not also offer is a gesture nobody
   discovers.

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

  // Nothing is drawn. The listener above is the whole component.
  return null;
}
