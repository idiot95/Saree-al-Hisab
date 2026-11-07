'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { landed } from './pending';

/* Tells pending.ts that this screen is on the phone, so the frame drawn at the tap can come down (PendingSkeleton).
   Rendered by <Screen> and by the error and not-found screens — never inside a loading.tsx (a client component there
   loses the CSP nonce; see StillTabBar). Draws nothing. */
export default function Landed() {
  const path = usePathname();
  /* A layout effect, so the frame starts to leave in the same commit that put this screen in, before it is painted. */
  useLayoutEffect(() => { landed(path); }, [path]);
  return null;
}
