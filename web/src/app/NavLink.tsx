'use client';

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';
import { startPending } from './pending';

/* Every link in the app, prefetching on intent rather than on sight.

   Next prefetches a <Link> the moment it scrolls into view, and prefetches
   again whenever a Server Action revalidates. Every screen here is rendered
   per request from a household's books, so each of those prefetches is a
   server render and a database round trip — and a list of entries, a deck of
   tiles and the tab bar together made about a hundred of them a second while
   somebody tapped around. The tap they actually made queued behind the lot,
   which is what "clicking is slow" was.

   So a link stays quiet until someone shows they mean it — a finger coming
   down on it, a pointer over it, keyboard focus — and only then asks for the
   route, a beat ahead of the click. A `prefetch` passed explicitly still wins. */
export default function NavLink({ prefetch, onPointerDown, onMouseEnter, onFocus, onClick, ...rest }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  const arm = () => { if (!intent) setIntent(true); };
  return (
    <Link
      {...rest}
      prefetch={prefetch !== undefined ? prefetch : intent ? null : false}
      onPointerDown={(e) => { arm(); onPointerDown?.(e); }}
      onMouseEnter={(e) => { arm(); onMouseEnter?.(e); }}
      onFocus={(e) => { arm(); onFocus?.(e); }}
      onClick={(e) => {
        onClick?.(e);
        /* A plain tap on a link that goes somewhere of ours draws that screen's
           skeleton at once. Not a click the handler above took over (the Add
           tab opens its options), not a new tab or a modified click. */
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (rest.target === '_blank' || typeof rest.href !== 'string') return;
        startPending(rest.href);
      }}
    />
  );
}
