/* The screen a tap is on its way to, before the server has answered, and how it should arrive.

   A tiny store rather than React state, because the thing that starts a navigation (a link, a swipe action, a save,
   Back) and the thing that draws the frame (PendingSkeleton, in the root layout) are nowhere near each other in the
   tree. Client only: every function here is called from a handler or an effect.

   The navigation is done when the destination's own <Screen> has mounted (`landed`), not when the address changes:
   a route the phone has no loading frame for commits an empty page first, and the frame has to stay over that. */

/** How the destination comes on: deeper (push), back out (pop), sideways between tabs, or a plain fade. */
export type Motion = 'push' | 'pop' | 'tab-left' | 'tab-right' | 'fade';

export type Pending = {
  /** path and query: Activity's chips each have a frame of their own (`/entries?f=review`) */
  target: string;
  path: string;
  motion: Motion;
  /** same path, another query (the month pill, a chip): the screen stays and only dims */
  same: boolean;
};

let state: Pending | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

/* A same-screen change dims what is below the header while it is on its way (globals.css, [data-pending-same]). Set
   here, in the tap's own handler, so it is in the very next frame. */
const dim = (on: boolean) => {
  try { document.documentElement.toggleAttribute('data-pending-same', on); } catch { /* no document: nothing to dim */ }
};

/** Mark a navigation as started. Another origin, or exactly where the screen already is, draws nothing. */
export function startPending(href: string, motion: Motion = 'push') {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const same = url.pathname === window.location.pathname;
    if (same && url.search === window.location.search) return;
    state = { target: url.pathname + url.search, path: url.pathname, motion, same };
    dim(same);
  } catch { return; }
  tell();
}

export function clearPending() {
  if (state === null) return;
  state = null;
  dim(false);
  tell();
}

/** A screen's <Screen> mounted at `pathname`: if it is the one we were waiting for, it is here. */
export function landed(pathname: string) {
  if (state && !state.same && state.path === pathname) clearPending();
}

/** The address changed. Somewhere other than the target (a redirect, Back, another tab): stop waiting. The target
 *  itself: a same-screen change is done; a new screen is done when it lands. */
export function moved(pathname: string) {
  if (!state) return;
  if (state.path !== pathname) { clearPending(); return; }
  if (state.same && state.target === pathname + window.location.search) clearPending();
}

export const subscribePending = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const pendingState = () => state;
export const pendingTarget = () => state?.target ?? null;
