'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { replacing, visited } from './backStack';

/** Records each in-app address for Back (backStack.ts). Draws nothing. */
export default function NavTrail() {
  const path = usePathname();
  const search = useSearchParams();
  /* A `<Link replace>` says so with data-replace; this hears the click before the Link handles it (capture, on the
     document), so the address it brings is recorded as a replace, as the history does. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // A click that opens a new tab or window (or is not the main button) navigates nothing here.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[data-replace]');
      // A link to where the page already is goes nowhere, so it marks nothing.
      if (a instanceof HTMLAnchorElement && a.href !== location.href) replacing(a.href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  useEffect(() => {
    const q = search.toString();
    visited(q ? `${path}?${q}` : path);
  }, [path, search]);
  return null;
}
