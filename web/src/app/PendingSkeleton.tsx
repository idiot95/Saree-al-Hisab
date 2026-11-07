'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { SkeletonFor, frameFor } from './Skeleton';
import { clearPending, moved, pendingState, subscribePending, type Motion, type Pending } from './pending';
import { instantState, serverInstant, subscribeInstant } from './add/instant';

/* The frame of the screen you tapped, drawn the instant you tap it, and the motion of getting there.

   Most routes are not prefetched (NavLink), so a tap would otherwise sit on the old screen until the server
   answered — and a route whose loading.tsx the phone did not know committed an empty page first. This draws the
   destination's own frame (the same one its loading.tsx streams) in the frame after the tap, moving the way the
   navigation goes: pushed in from the right, popped in from the left, across a short way between tabs. It stays
   over everything until the destination's <Screen> has mounted (pending.ts `landed`), so no blank page is ever
   seen, and then dissolves over --dur-1 while the screen underneath is already live: content is never held back
   for an animation. If the screen lands before the frame has finished moving, the frame simply fades from where
   it is.

   No grace period any more: a frame that would have been on screen for a single frame starts transparent or
   off-screen and fades straight back out, which reads as a dissolve, not a flicker. A ceiling (10s) still takes it
   down if a navigation never lands (no signal), so the phone is never left behind a frame. Same-screen changes (the
   month pill, a chip) draw no frame: the screen dims below its header instead (pending.ts). */

/* Where the frame comes from, and how long it takes: transitions from @starting-style, so a frame that is told to
   leave halfway in turns round from wherever it is. Reduced motion makes all of it instant (globals.css). */
const ENTER: Record<Motion, string> = {
  push: 'starting:translate-x-full [transition:translate_var(--dur-3)_var(--ease-out),opacity_var(--dur-1)_var(--ease-in)]',
  pop: 'starting:-translate-x-1/4 starting:opacity-0 [transition:translate_var(--dur-3)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  'tab-right': 'starting:translate-x-4 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  'tab-left': 'starting:-translate-x-4 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
  fade: 'starting:translate-y-2 starting:opacity-0 [transition:translate_var(--dur-2)_var(--ease-out),opacity_var(--dur-2)_var(--ease-out)]',
};
/** How long a leaving frame stays in the tree: its fade (--dur-1) and a frame to spare. */
const LEAVE_MS = 160;

export default function PendingSkeleton() {
  const pending = useSyncExternalStore(subscribePending, pendingState, () => null);
  /* The tab bar's plus opens its drawer on the tap: the drawer is the feedback, and a full-page Add frame behind it
     would only flash. */
  const instant = useSyncExternalStore(subscribeInstant, instantState, serverInstant).open;
  const path = usePathname();
  const search = useSearchParams();
  /* The last frame drawn, kept through its fade once the navigation it stood for has landed. Remembered during
     render (not in an effect), so the frame turns into its leaving self in the very commit that cleared it, with no
     frame of nothing in between. */
  const [last, setLast] = useState<Pending | null>(null);
  if (pending && pending !== last) setLast(pending);

  /* The address moved: somewhere else entirely, or a same-screen change that is now done. Before paint, so the dim
     never outlives the commit that brought the new state. */
  useLayoutEffect(() => { moved(path); }, [path, search]);

  // A navigation that never lands (no signal) does not leave the phone behind a frame.
  useEffect(() => {
    if (!pending) return;
    const giveUp = setTimeout(clearPending, 10000);
    return () => clearTimeout(giveUp);
  }, [pending]);

  // Landed: the frame dissolves (--dur-1), then leaves the tree.
  useEffect(() => {
    if (pending || !last) return;
    const gone = setTimeout(() => setLast(null), LEAVE_MS);
    return () => clearTimeout(gone);
  }, [pending, last]);

  const p = pending ?? last;
  const target = p?.target ?? null;
  /* The frame itself is drawn once per target: the commit that turns it into its leaving self (the one that put the
     destination on screen) changes only the wrapper's class, so it costs that commit nothing. */
  const frame = useMemo(() => (target ? <SkeletonFor path={target} stillBar={false} /> : null), [target]);
  if (!p || p.same || !frameFor(p.target)) return null;
  if (instant && frameFor(p.target) === 'add') return null;
  const out = !pending;
  return (
    <div key={p.target} data-pending-frame="" data-leaving={out ? '' : undefined} aria-hidden={out || undefined}
      className={cn('fixed inset-0 z-39 overflow-hidden bg-background', ENTER[p.motion],
        out && 'pointer-events-none opacity-0 [transition:translate_var(--dur-3)_var(--ease-out),opacity_var(--dur-1)_var(--ease-in)]')}>
      {/* The real tab bar sits above at z 40, so the frame draws none of its own. */}
      {frame}
    </div>
  );
}
