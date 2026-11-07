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
  /** the query the screen had when the tap was made: a same-screen change is done once the address leaves it */
  from: string;
};

let state: Pending | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

/* A same-screen change dims what is below the header while it is on its way (globals.css, [data-pending-same]). Set
   here, in the tap's own handler, so it is in the very next frame. */
const dim = (on: boolean) => {
  try { document.documentElement.toggleAttribute('data-pending-same', on); } catch { /* no document: nothing to dim */ }
};

/** Mark a navigation as started. Another origin draws nothing. A tap to exactly where the screen already is draws
 *  nothing either, and supersedes whatever was on its way: Next drops the earlier navigation, so nothing would ever
 *  land to take its frame or dim down. */
export function startPending(href: string, motion: Motion = 'push') {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    const same = url.pathname === window.location.pathname;
    if (same && url.search === window.location.search) { clearPending(); return; }
    state = { target: url.pathname + url.search, path: url.pathname, motion, same, from: window.location.search };
    dim(same);
  } catch { return; }
  /* The frame is a full screen of markup, a long render on a slow phone. Drawn in the tap's own task it would hold
     back the paint of the press the finger just made (NavLink draws it on the lift for a quick tap), so it waits for
     that frame to be painted and comes in the next. The dim above is a single attribute and goes at once. */
  requestAnimationFrame(() => requestAnimationFrame(tell)); // not a timer: Chrome holds those back after a touch
}

/** Only if what is on its way is `path` (the Add drawer, put away before its /add landed, draws no frame of its
 *  own and must not leave one behind — but a tab tapped since then is someone else's navigation). */
export function clearPendingTo(path: string) {
  if (state?.path === path) clearPending();
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

/** The address changed. Somewhere other than the target's screen (a redirect, Back, another tab): stop waiting. The
 *  same screen with any other query than the one the tap left (its target, or a near one: a save that started `/` and
 *  pushed `/?saved=…`): a same-screen change is done. A new screen is done when it lands. */
export function moved(pathname: string) {
  if (!state) return;
  if (state.path !== pathname) { clearPending(); return; }
  if (state.same && window.location.search !== state.from) clearPending();
}

export const subscribePending = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const pendingState = () => state;
