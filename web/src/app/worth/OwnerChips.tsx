'use client';

import Link from 'next/link';
import { haptic } from '../haptics';

/* Whose net worth: Household · Me · each other member · Joint.

   Each chip is a link to ?o=…, so without script it is plain navigation and the server draws that set. With
   script the tap is taken here instead: the set is swapped in place (so the figures roll rather than reload)
   and the address is replaced to match, so a refresh or a shared link opens on the same chip. */
export default function OwnerChips({ chips, current, onPick }: {
  chips: { key: string; chip: string }[]; current: string; onPick: (key: string) => void;
}) {
  return (
    <nav aria-label="Whose net worth" className="flex flex-wrap gap-2 px-[var(--gutter)]">
      {chips.map((c) => {
        const on = c.key === current;
        const href = c.key === 'household' ? '/worth' : `/worth?o=${encodeURIComponent(c.key)}`;
        return (
          <Link key={c.key} href={href} replace data-replace scroll={false} prefetch={false}
            aria-current={on ? 'true' : undefined}
            onClick={(e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              if (on) return;
              haptic('select');
              onPick(c.key);
              window.history.replaceState(null, '', href);
            }}
            className={`press flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors ${on
              ? 'border-primary bg-primary font-semibold text-primary-foreground'
              : 'border-border bg-card font-medium text-foreground'}`}>
            {c.chip}
          </Link>
        );
      })}
    </nav>
  );
}
