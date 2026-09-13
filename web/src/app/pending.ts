/* The screen a tap is on its way to, before the server has answered.

   A tiny store rather than React state, because the thing that starts a
   navigation (a link, a swipe action, a save) and the thing that draws the
   skeleton (PendingSkeleton, in the root layout) are nowhere near each other
   in the tree. Client only: every function here is called from a handler. */

let target: string | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((l) => l());

/** Mark a navigation as started. Another origin, or the same screen (a month
 *  change on Entries), draws nothing — the current screen is still right. */
export function startPending(href: string) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
    target = url.pathname;
  } catch { return; }
  tell();
}

export function clearPending() {
  if (target === null) return;
  target = null;
  tell();
}

export const subscribePending = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const pendingTarget = () => target;
