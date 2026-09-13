'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { SkeletonFor, frameFor } from './Skeleton';
import { clearPending, pendingTarget, subscribePending } from './pending';

/* The skeleton of the screen you tapped, drawn the instant you tap it.

   Links no longer prefetch on sight (see NavLink), so the route's loading.tsx
   is not on the phone ahead of time: without this, a tap would sit on the old
   screen until the server streamed the loading shell back. This draws the
   same frame straight away, over the old screen and under the tab bar, and
   takes it down the moment the navigation lands — the new page, or its own
   loading shell, is then what is on screen.

   A beat of grace first (120ms): a screen already in the client cache arrives
   faster than that, and a skeleton flashed for one frame over a page that was
   ready reads as a flicker, not as speed. And a ceiling (10s), so a navigation
   that never lands — no signal — does not leave the phone behind a skeleton. */
export default function PendingSkeleton() {
  const target = useSyncExternalStore(subscribePending, pendingTarget, () => null);
  const path = usePathname();
  const [shown, setShown] = useState<string | null>(null);

  // The navigation landed: whatever was pending is done.
  useEffect(() => { clearPending(); }, [path]);

  useEffect(() => {
    if (!target) return;
    const show = setTimeout(() => setShown(target), 120);
    const giveUp = setTimeout(clearPending, 10000);
    return () => { clearTimeout(show); clearTimeout(giveUp); };
  }, [target]);

  if (!target || shown !== target || !frameFor(target)) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 39, overflow: 'hidden', background: 'var(--c-bg)' }}>
      {/* The real tab bar sits above at z 40, so the frame draws none of its own. */}
      <SkeletonFor path={target} stillBar={false} />
    </div>
  );
}
