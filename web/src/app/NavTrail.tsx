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
      const a = (e.target as Element | null)?.closest?.('a[data-replace]');
      if (a instanceof HTMLAnchorElement) replacing(a.href);
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
