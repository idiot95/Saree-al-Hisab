'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { tokenMs } from './motion';
import { SkeletonFor, frameFor } from './Skeleton';
import { clearPending, moved, pendingState, subscribePending, type Motion, type Pending } from './pending';
import { instantState, serverInstant, subscribeInstant } from './add/instant';

/* The frame of the screen you tapped, drawn the instant you tap it, and the motion of getting there.

   Most routes are not prefetched (NavLink), so a tap would otherwise sit on the old screen until the server
   answered — and a route whose loading.tsx the phone did not know committed an empty page first. This draws the
   destination's own frame (the same one its loading.tsx streams) as soon as the press under the finger has been
   painted (pending.ts), moving the way the
   navigation goes: pushed in from the right, popped in from the left, across a short way between tabs. It stays
   over everything until the destination's <Screen> has mounted (pending.ts `landed`), so no blank page is ever
   seen.

   Then it gets out of the way at once. In the commit that put the screen in, the frame stops wherever its entry
   had got to (its translate is frozen there, never carried on over live content), stops taking taps, and fades out
   over --dur-1 on ease-out, so it is mostly gone within a few frames. Content is never held back for an animation.

   No grace period: a frame that lands in a frame or two starts transparent or off-screen and is faded straight back
   out, which reads as a dissolve, not a flicker. A ceiling (10s) still takes it down if a navigation never lands
   (no signal). Same-screen changes (the month pill, a chip) draw no frame: the screen dims below its header
   instead (pending.ts). */

/* Where the frame comes in from, and how long it takes: transitions from @starting-style. Reduced motion makes all
   of it instant (globals.css). */
const ENTER: Record<Motion, string> = {
  push: 'starting:translate-x-full [transition:translate_var(--dur-3)_var(--ease-out)]',
  pop: 'starting:-translate-x-1/4 starting:opacity-0 [transition:translate_var(--dur-3)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  'tab-right': 'starting:translate-x-4 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  'tab-left': 'starting:-translate-x-4 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  fade: 'starting:translate-y-2 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
};

/** How long a leaving frame stays in the tree: its fade (--dur-1, read from the token) and a frame or two to spare. */
const leaveMs = () => tokenMs('--dur-1', 120) + 40;

/** A key per navigation, not per address: a tap back to the address whose frame is still fading must draw a fresh
 *  frame, not reuse the faded one. */
const ids = new WeakMap<Pending, number>();
let nextId = 0;
const keyOf = (p: Pending) => { let k = ids.get(p); if (k === undefined) { k = ++nextId; ids.set(p, k); } return k; };

const draws = (p: Pending | null, instant: boolean): p is Pending =>
  !!p && !p.same && !!frameFor(p.target) && !(instant && frameFor(p.target) === 'add');

export default function PendingSkeleton() {
  const pending = useSyncExternalStore(subscribePending, pendingState, () => null);
  const instant = useSyncExternalStore(subscribeInstant, instantState, serverInstant).open;
  const path = usePathname();
  const search = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  /* The frame on screen, kept through its fade once the navigation it stood for is over. Mirrored from the store
     during render (not in an effect), so the frame turns into its leaving self in the very commit that cleared it.
     While something is pending it is exactly what that draws (nothing, for a dim or an instant Add), so a frame a
     newer tap replaced never comes back to leave later. */
  const [last, setLast] = useState<Pending | null>(null);
  if (pending) {
    const now = draws(pending, instant) ? pending : null;
    if (now !== last) setLast(now);
  }

  /* The address moved: somewhere else entirely, or a same-screen change that is now done. Before paint, so the dim
     never outlives the commit that brought the new state. */
  useLayoutEffect(() => { moved(path); }, [path, search]);

  // A navigation that never lands (no signal) does not leave the phone behind a frame.
  useEffect(() => {
    if (!pending) return;
    const giveUp = setTimeout(clearPending, 10000);
    return () => clearTimeout(giveUp);
  }, [pending]);

  const out = !pending && !!last;

  /* Leaving: freeze the frame where its entry had got to and fade it from there. The translate is read while its
     own transition is still running and written back inline with that transition taken away, so it stops dead; the
     fade is the only motion left. Then it leaves the tree. */
  useLayoutEffect(() => {
    const el = box.current;
    if (!out || !el) return;
    const at = getComputedStyle(el);
    const translate = at.translate;
    const opacity = at.opacity;
    el.style.transition = 'opacity var(--dur-1) var(--ease-out)';
    el.style.translate = translate;
    el.style.opacity = opacity;
    void el.offsetWidth; // the fade starts from where the frame is now
    el.style.opacity = '0';
    const gone = setTimeout(() => setLast(null), leaveMs());
    return () => clearTimeout(gone);
  }, [out]);

  const p = pending && draws(pending, instant) ? pending : out ? last : null;
  const target = p?.target ?? null;
  /* The frame itself is drawn once per target: the commit that turns it into its leaving self (the one that put the
     destination on screen) changes only the wrapper, so it costs that commit nothing. */
  const frame = useMemo(() => (target ? <SkeletonFor path={target} stillBar={false} /> : null), [target]);
  if (!p) return null;
  return (
    <div ref={box} key={keyOf(p)} data-pending-frame="" data-leaving={out ? '' : undefined} aria-hidden={out || undefined}
      className={cn('fixed inset-0 z-39 overflow-hidden bg-background', ENTER[p.motion], out && 'pointer-events-none')}>
      {/* The real tab bar sits above at z 40, so the frame draws none of its own. */}
      {frame}
    </div>
  );
}
