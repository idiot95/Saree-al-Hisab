'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { haptic } from './haptics';
import { goBack } from './backStack';
import { Icon } from './Icon';

/* The header's Back arrow. A real link to the screen's parent — so it works before the script has arrived, and
   long-press and new-tab do the sensible thing — but a tap returns to where you actually came from, the screen it returns to drawn coming back in from the tap
   (goBack starts a pop). */
export default function BackLink({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Link href={to} motion="pop" aria-label="Back"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        haptic('tap');
        goBack(router, to);
      }}
      className="press -mb-1 -ml-3 grid size-11 place-items-center rounded-full text-foreground active:bg-muted data-pressed:bg-muted">
      <Icon name="chevron_left" size={22} />
    </Link>
  );
}
