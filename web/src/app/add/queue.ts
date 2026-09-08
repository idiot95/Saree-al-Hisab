import type { Draft } from './actions';
import type { Way } from '@/lib/pay';

/* Entries recorded with no signal, kept on the phone until they can be sent.

   The service worker caches no pages, by rule: a page is household data, and
   household data does not belong on disk in a browser cache. This store is
   the one deliberate exception, kept as small as the job allows — the entries
   a person typed while offline, and the names they need to type them (which
   category, which way of paying). Each entry leaves the moment it is
   accepted; the names are replaced whenever Add Entry is opened online and
   wiped the moment anyone reaches the sign-in screen.

   Every entry carries a reference minted here on the phone. The server keeps
   it beside the row, so sending the same entry twice — a retry after a reply
   that never arrived — produces one row, not two. That is what makes it safe
   to try again on every reconnect without ever asking "did it go?". */

export type Queued = Draft & {
  clientRef: string;
  householdId: string;
  queuedAt: string;
  /** Set when the server looked at it and said no. It stays on the phone,
      with the reason, until the person discards it. */
  stuck?: string;
};

export type Pickers = {
  householdId: string;
  /** parent fields are absent on a device that last opened Add Entry before
      categories could nest; such a row simply stands on its own. */
  categories: {
    id: string; name: string; tint: string; icon: string; parent_id?: string | null; parent?: string | null;
    scope?: 'expense' | 'income' | 'both';
  }[];
  /** Every account with its rails. Absent on a device that last opened Add
      Entry when only the rails were kept; such a phone shows the bare
      screen until it opens Add Entry with signal once more. */
  ways?: Way[];
  /** Absent on a device that last opened Add Entry before tabs existed. */
  tabs?: { id: string; name: string; people: number; last_counts: boolean | null }[];
  savedAt: string;
};

const QUEUE = 'ql.queue.v1';
const PICKERS = 'ql.pickers.v1';

/* Storage can be absent (private browsing on some phones) or full, and
   neither is worth a crash on a finance screen. Reads fall back to nothing;
   writes fail quietly and the caller's own copy still stands. */
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* see above */ }
  // Same-tab listeners: the `storage` event only fires in OTHER tabs.
  try { dispatchEvent(new Event(CHANGED)); } catch { /* not in a browser */ }
}

const CHANGED = 'ql:device-changed';

/** For useSyncExternalStore: wakes on any write here, or one in another tab. */
export function subscribe(fn: () => void) {
  addEventListener(CHANGED, fn);
  addEventListener('storage', fn);
  return () => { removeEventListener(CHANGED, fn); removeEventListener('storage', fn); };
}

/* Snapshots have to be the same object while the stored text is unchanged,
   or React sees a new array on every read and renders forever. Cached by the
   raw string, which is the cheapest equality there is. */
function cachedRead<T>(key: string) {
  let raw: string | null | undefined, value: T | null = null;
  return () => {
    let now: string | null = null;
    try { now = localStorage.getItem(key); } catch { /* absent storage: nothing */ }
    if (now !== raw) {
      raw = now;
      try { value = now ? (JSON.parse(now) as T) : null; } catch { value = null; }
    }
    return value;
  };
}
const queueSnapshot = cachedRead<Queued[]>(QUEUE);
const pickersSnapshot = cachedRead<Pickers>(PICKERS);
const EMPTY: Queued[] = [];
export const snapshotQueue = () => queueSnapshot() ?? EMPTY;
export const snapshotPickers = () => pickersSnapshot();
export const nothing = () => null;
export const none = () => EMPTY;

export const readQueue = (): Queued[] => read<Queued[]>(QUEUE) ?? [];

export function enqueue(d: Draft, householdId: string): Queued {
  const item: Queued = {
    ...d, householdId, clientRef: crypto.randomUUID(), queuedAt: new Date().toISOString(),
  };
  write(QUEUE, [...readQueue(), item]);
  return item;
}

export function dequeue(clientRef: string) {
  write(QUEUE, readQueue().filter((q) => q.clientRef !== clientRef));
}

export function markStuck(clientRef: string, why: string) {
  write(QUEUE, readQueue().map((q) => (q.clientRef === clientRef ? { ...q, stuck: why } : q)));
}

export const readPickers = () => read<Pickers>(PICKERS);
export const writePickers = (p: Pickers) => write(PICKERS, p);

/** The sign-in screen: whoever is about to sign in, it is not this session. */
export function forgetDevice() {
  try { localStorage.removeItem(QUEUE); localStorage.removeItem(PICKERS); } catch { /* nothing to forget */ }
  try { dispatchEvent(new Event(CHANGED)); } catch { /* not in a browser */ }
}

/* One drain at a time, across every component that might ask for one: the
   layout on mount, the `online` event, and a page that has just queued
   something. Two drains in flight would send the same entry twice — the
   server would still only keep one, but the round trips are wasted. */
let draining: Promise<Drained> | null = null;

export type Drained = { sent: number; stuck: number; left: number };

export function drain(
  send: (q: Queued) => Promise<{ ok: true; id: string } | { ok: false; error: string }>,
): Promise<Drained> {
  if (draining) return draining;
  draining = (async () => {
    let sent = 0, stuck = 0;
    for (const q of readQueue()) {
      if (q.stuck) { stuck++; continue; }
      let r;
      try { r = await send(q); } catch { break; }  // no signal, or the server is unreachable: later
      if (!r) break;  // the action answered with a redirect — signed out; nothing to do here
      if (r.ok) { dequeue(q.clientRef); sent++; }
      else { markStuck(q.clientRef, r.error); stuck++; }
    }
    return { sent, stuck, left: readQueue().length };
  })().finally(() => { draining = null; });
  return draining;
}
