'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import { landed } from './pending';
import { noteScreen } from './Reveal';

/* Tells pending.ts that this screen is on the phone, so the frame drawn at the tap can come down (PendingSkeleton).
   Rendered by <Screen> and by the error and not-found screens — never inside a loading.tsx (a client component there
   loses the CSP nonce; see StillTabBar). Draws nothing. */
export default function Landed() {
  const path = usePathname();
  /* A layout effect, so the frame starts to leave in the same commit that put this screen in, before it is painted. */
  useLayoutEffect(() => { landed(path); }, [path]);
  /* Where this screen was mounted, once: the Add drawer over it moves the address to /add without moving the screen,
     and its Save brings the same screen back at the same path, which is a redraw, not an arrival (Reveal). */
  const at = useRef(path);
  useLayoutEffect(() => { noteScreen(at.current); }, []);
  return null;
}
