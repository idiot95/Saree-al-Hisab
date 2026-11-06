'use client';

/* Where Back should go: to where you actually were, the way an iPhone's Back does — the same month, the same
   filter, the same scroll — and only to a screen's fixed parent when there is nowhere in the app to return to
   (opened from a link, a bookmark, or a fresh launch). A fixed parent alone sent an entry opened from Home's
   "Today" back to Activity, and a September entry back to October.

   The trail is the in-app addresses visited this session, newest last. A move to the address just before the
   newest is a step back and pops; anything else is a step forward and pushes. sessionStorage, so it lives as long
   as the tab and no longer, and a read or write that throws (private mode, storage full) only costs the history. */
const KEY = 'ql.trail.v1';
const MAX = 40;

function read(): string[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
function write(trail: string[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX))); } catch { /* the trail is a convenience */ }
}

/* A replacing navigation leaves the history no new step, so the trail must not get one either, or canGoBack would
   promise a screen that is not there. Which navigations replace is said where they happen, not guessed from the
   addresses: every `<Link replace>` carries `data-replace` (NavTrail's click listener calls `replacing` with its
   href), and every `router.replace` or `history.replaceState` calls `replacing` first. scripts/back.test.mjs fails
   if one does not. The mark applies only to the address it names, once; an address in between does not spend it
   (a replace called from an effect can be marked before the trail has heard of the address it replaces — the
   saved snack's tidy-up on Home after Back), and a mark that is never followed lapses after a few seconds. */
const LAPSE_MS = 10_000;
let pending: { url: string; at: number } | null = null;

/** The same address however it was spelled: path, then the query as URLSearchParams writes it. */
export function normal(url: string) {
  try {
    const u = new URL(url, 'http://x');
    const q = u.searchParams.toString();
    return q ? `${u.pathname}?${q}` : u.pathname;
  } catch { return url; }
}

/** The next arrival at `url` replaces the current address rather than pushing a new one. */
export function replacing(url: string) {
  pending = { url: normal(url), at: Date.now() };
}

/** Called on every route change with the full address (path and query). */
export function visited(url: string) {
  const mark = pending && Date.now() - pending.at < LAPSE_MS ? pending : null;
  const replaced = !!mark && mark.url === normal(url);
  if (replaced || !mark) pending = null;
  const trail = read();
  if (trail[trail.length - 1] === url) return;
  if (replaced && trail.length) { trail[trail.length - 1] = url; write(trail); return; }
  if (trail[trail.length - 2] === url) { trail.pop(); write(trail); return; }
  trail.push(url);
  write(trail);
}

/** Is there an in-app screen to go back to? */
export function canGoBack() {
  return read().length >= 2;
}

/** Back: history when there is somewhere in the app to return to, else the screen's fixed parent. */
export function goBack(router: { back: () => void; push: (href: string, o?: { transitionTypes?: string[] }) => void }, fallback: string) {
  if (canGoBack()) router.back();
  else router.push(fallback, { transitionTypes: ['nav-back'] });
}
