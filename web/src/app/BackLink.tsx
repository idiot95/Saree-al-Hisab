'use client';

import Link from '@/app/NavLink';
import { useRouter } from 'next/navigation';
import { haptic } from './haptics';
import { goBack } from './backStack';
import { Icon } from './Icon';

/* The header's Back arrow. A real link to the screen's parent — so it works before the script has arrived, and
   long-press and new-tab do the sensible thing — but a tap returns to where you actually came from. */
export default function BackLink({ to }: { to: string }) {
  const router = useRouter();
  return (
    <Link href={to} transitionTypes={['nav-back']} aria-label="Back"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        haptic('tap');
        goBack(router, to);
      }}
      className="-mb-1 -ml-3 grid size-11 place-items-center rounded-full text-foreground">
      <Icon name="chevron_left" size={22} />
    </Link>
  );
}
