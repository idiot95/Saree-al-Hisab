'use client';

/* The Add drawer, opened on the tap rather than on the server's answer.

   Tapped from the tab bar, /add used to wait for its route — a server render with every picker in it — before the
   drawer could start its slide: about a second on a phone. The names the form needs are already on the phone
   (ql.pickers.v1, kept for the offline screen and rewritten each time Add opens with signal), so the drawer is drawn
   from them at once (InstantAdd, in the root layout) while the router fetches /add behind it. When the route lands,
   its page hands the fresh pickers to the drawer already open (AddSheet) instead of opening a second one, and the
   form takes them without losing a digit typed in the meantime.

   This store is that hand-over, and nothing more: whether the tab bar opened the drawer, the address it was opened
   over, the route's fresh props once they arrive, whether the address has reached /add yet (so a close before then
   does not step back off the screen underneath), and a close that came before the route did.

   A navigation to /add can also never land: Back, another tab or a redirect to /signin starts a new navigation and
   Next drops the pending one. So the drawer is abandoned the moment the address moves anywhere but /add before
   landing. A close-before-landing is held until the /add it was for arrives (and is stepped back off), however late:
   it is forgotten only when the address moves off the screen it was opened over, when the plus opens again, or when
   the person starts another /add themselves — any click on a link to /add (InstantAdd listens), since Next then
   drops the one that was cancelled. A card's Pay or a tab's Add cost (always with a query) is never mistaken for it. */

import type { ComponentProps } from 'react';
import type AddEntry from './AddEntry';
import type { Pickers } from './queue';

export type AddProps = Omit<ComponentProps<typeof AddEntry>, 'sheet' | 'children' | 'onQueued' | 'offline' | 'cached' | 'onClose'>;

type State = {
  /** The tab bar opened the drawer and it has not been put away. */
  open: boolean;
  /** Bumped on every open, so a drawer's form starts fresh each time. */
  session: number;
  /** The route's own props, once its page has rendered. */
  fed: AddProps | null;
  /** The address has reached /add during this session. */
  landed: boolean;
  /** Put away before the route arrived: when it does, it is stepped back off at once. */
  cancelled: boolean;
  /** The address (path and query) the drawer was opened over, noted by InstantAdd on its first look. */
  origin: string | null;
};

let state: State = { open: false, session: 0, fed: null, landed: false, cancelled: false, origin: null };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export const subscribeInstant = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const instantState = () => state;
const CLOSED: State = { open: false, session: 0, fed: null, landed: false, cancelled: false, origin: null };
export const serverInstant = () => CLOSED;

/** The tab bar's plus: open now. */
export function openInstant() {
  if (state.open) return;
  set({ open: true, session: state.session + 1, fed: null, landed: false, cancelled: false, origin: null });
}

/** Where the drawer was opened over, once (InstantAdd's first look after the tap). */
export function noteOrigin(here: string) {
  if (state.open && state.origin === null && !state.landed) set({ origin: here });
}

/** The navigation to /add was dropped (Back, another tab, a redirect): shut, with no step back — the address is
 *  already somewhere else — and nothing left to cancel. */
export function abandonInstant() {
  if (state.open || state.cancelled) set({ open: false, landed: false, cancelled: false });
}

/** The route's page, with what the server loaded. */
export function feedInstant(props: AddProps) {
  if (state.open && state.fed !== props) set({ fed: props });
}

export function markLanded() {
  if (state.open && !state.landed) set({ landed: true });
}

/** Put away. Returns whether the address is at /add and so needs a step back; if the route has not arrived yet,
 *  its arrival is what gets stepped back off (takeCancelled). */
export function closeInstant(): boolean {
  if (!state.open) return false;
  const landed = state.landed;
  // `fed` stays, so the drawer slides away showing what it showed; the next open clears it.
  set({ open: false, landed: false, cancelled: !landed });
  return landed;
}

/** Whether a plain /add arriving now is the one put away before it landed. */
export function isCancelled(s: State, plain: boolean) {
  return s.cancelled && plain;
}

/** The route arrived after the drawer was put away: true once, for the page to step back. Anything else arriving
 *  (an /add with a query) clears the mark instead. */
export function takeCancelled(plain: boolean) {
  if (!state.cancelled) return false;
  const ours = isCancelled(state, plain);
  set({ cancelled: false });
  return ours;
}

/** The address moved on, or the person started another /add, after a close-before-landing: that /add will never
 *  come. */
export function forgetCancel() {
  if (state.cancelled) set({ cancelled: false });
}

/** How old the phone's pickers may be and still open the drawer. Each one is refreshed by the route within the second
 *  anyway; this only bounds what the first few hundred milliseconds can offer (a way to pay archived last month). */
const FRESH_MS = 7 * 24 * 3600 * 1000;

/** The pickers on this phone, if they are this household's, carry every way to pay, and are recent. */
export function freshPickers(p: Pickers | null, householdId: string | null, now = Date.now()): Pickers | null {
  if (!p || !householdId || p.householdId !== householdId) return null;
  if (!p.ways?.length) return null;
  const at = Date.parse(p.savedAt);
  if (!Number.isFinite(at) || now - at > FRESH_MS || at - now > 60_000) return null;
  return p;
}
