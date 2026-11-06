'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { tapped, visited } from './backStack';

/** Records each in-app address for Back (backStack.ts). Draws nothing. */
export default function NavTrail() {
  const path = usePathname();
  const search = useSearchParams();
  /* Every primary tap on a link, heard before the Link handles it (capture, on the document): a `<Link replace>` says
     so with data-replace, so the address it brings is recorded as a replace, as the history does; any other link
     drops a mark nobody spent (backStack `tapped`). */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // A click that opens a new tab or window (or is not the main button) navigates nothing here.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (a instanceof HTMLAnchorElement) tapped(a.href, a.hasAttribute('data-replace'), location.href);
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
