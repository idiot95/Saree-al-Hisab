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

/** Called on every route change with the full address (path and query). */
export function visited(url: string) {
  const trail = read();
  if (trail[trail.length - 1] === url) return;
  if (trail[trail.length - 2] === url) { trail.pop(); write(trail); return; }
  /* Activity's replacing moves leave the history no step, so the trail must not have one either, or canGoBack would
     promise a screen that is not there. */
  if (replacesOnActivity(trail[trail.length - 1], url)) { trail[trail.length - 1] = url; write(trail); return; }
  trail.push(url);
  write(trail);
}

/** Does a move from `prev` to `next` replace the address rather than push it? Only Activity's own: a chip (the view,
 *  ?f=, changes), and the ways out of one category (?c= dropped) or of a search (?q= dropped). The month pill and a
 *  search push, so they are steps like any other — a rule of "any /entries to /entries" swallowed them, and Back
 *  then left Activity after a month step instead of returning to the month before. (An empty search sent from the
 *  search page also pushes /entries and is counted as a replace: the trail then holds one step fewer than the
 *  history, which only ever sends Back to the fixed parent, never to a screen that is not there.) */
export function replacesOnActivity(prev: string | undefined, next: string) {
  if (!prev) return false;
  const [pp, pq = ''] = prev.split('?');
  const [np, nq = ''] = next.split('?');
  if (pp !== '/entries' || np !== '/entries') return false;
  const a = new URLSearchParams(pq), b = new URLSearchParams(nq);
  if ((a.get('f') || 'all') !== (b.get('f') || 'all')) return true;
  return (a.has('c') && !b.has('c')) || (a.has('q') && !b.has('q'));
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
