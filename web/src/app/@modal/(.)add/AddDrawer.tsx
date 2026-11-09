'use client';

import { useRouter } from 'next/navigation';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

/* Vaul's drawer around Add Entry: springs up, follows a drag on the handle, and closing it — drag, Escape, the veil —
   is a step back in history, so the screen underneath is exactly where it was. Not a BottomDrawer: the drawer is the
   route, and Add Entry lays out its own padding. DrawerContent gives it the Close grip all the same.

   Three things here are the Add drawer's own, and no other drawer's:
   - **The cap is 79dvh, not 86.** On an iPhone, vaul's repositionInputs lifts a drawer that is at most 80% of the
     window to 26px from the top when the keyboard comes up, and keeps a taller one's top edge where it was, squeezing
     everything into what is left — which put Save over the amount in a Safari tab (ux-audit C2). Under 80% it always
     takes the branch that lifts it. The pickers and Wealth's drawers carry no tall form under a keyboard and keep 86.
     Android keeps 86 here too: Chrome shrinks the page for its keyboard (interactive-widget=resizes-content), so vaul
     has nothing to reposition, and 79 would only add 7% of veil above a drawer that is already short.
   - **Save is not inside the scroller.** Add Entry scrolls its form above Save (data-add-scroll) rather than letting
     it pass under a sticky footer, so a focused field scrolled "into view" — by the browser, by vaul — lands above
     Save, and nothing is drawn under it at rest.
   - **It opens in 240ms on an enter curve**, not vaul's 500ms (perf-findings fix 5); vaul's own curve and duration
     stay for a drag let go and for closing. Important, because vaul's stylesheet is unlayered and Tailwind's is not. */
export default function AddDrawer({ children, open = true, onClose }: {
  children: React.ReactNode;
  /** Drawn by InstantAdd before its route has arrived: open and closed by the tap, not by the address. */
  open?: boolean;
  /** Put away. The route's own drawer steps back in history. */
  onClose?: () => void;
}) {
  const router = useRouter();
  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) { if (onClose) onClose(); else router.back(); } }}>
      <DrawerContent data-add-drawer
        overlayClassName="data-[state=open]:[animation-duration:var(--dur-3)]! data-[state=open]:[animation-timing-function:var(--ease-out)]!"
        className="bg-background data-[vaul-drawer-direction=bottom]:max-h-[79dvh] in-data-[platform=android]:data-[vaul-drawer-direction=bottom]:max-h-[86dvh] data-[state=open]:[animation-duration:var(--dur-3)]! data-[state=open]:[animation-timing-function:var(--ease-out)]!">
        <DrawerTitle className="sr-only">New entry</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
