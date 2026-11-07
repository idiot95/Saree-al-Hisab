'use client';

import { useSyncExternalStore } from 'react';

/* How much of the layout viewport the on-screen keyboard is covering, in CSS pixels.

   iOS Safari does not shrink the page for its keyboard: the layout viewport stays full height and the keyboard
   slides over the bottom of it, taking a sticky Save with it. The visual viewport does shrink, so the difference
   is the keyboard. Android Chrome is told to resize the content instead (`interactive-widget=resizes-content` in
   the viewport meta), so there the two agree and this reads 0 — one rule for both, no platform sniffing. */

function subscribe(fn: () => void) {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return () => {};
  vv.addEventListener('resize', fn);
  vv.addEventListener('scroll', fn);
  return () => { vv.removeEventListener('resize', fn); vv.removeEventListener('scroll', fn); };
}
const idle = () => () => {};
const zero = () => 0;

function inset() {
  const vv = window.visualViewport;
  if (!vv) return 0;
  /* Pinch-zoomed: the visual viewport is smaller because it is magnified, not
     because a keyboard is up. Lifting Save then would float it mid-screen. */
  if (Math.abs(vv.scale - 1) > 0.01) return 0;
  const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
  // Under a few pixels is rounding or the browser's own bar settling, not a keyboard.
  return covered > 40 ? covered : 0;
}

/** Disabled (inside the drawer, which vaul resizes itself) it listens to nothing. */
export function useKeyboardInset(enabled = true) {
  return useSyncExternalStore(enabled ? subscribe : idle, enabled ? inset : zero, zero);
}
