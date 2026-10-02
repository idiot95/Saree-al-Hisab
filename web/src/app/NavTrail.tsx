'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { visited } from './backStack';

/** Records each in-app address for Back (backStack.ts). Draws nothing. */
export default function NavTrail() {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    const q = search.toString();
    visited(q ? `${path}?${q}` : path);
  }, [path, search]);
  return null;
}
