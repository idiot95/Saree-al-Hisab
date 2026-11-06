'use client';

import { createContext, useContext, useRef } from 'react';
import { Drawer as Vaul } from 'vaul';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/* The app's bottom drawer: shadcn's Drawer (vaul) with the few things every drawer here wants, so the call sites
   only say what is in it. It rises over the screen it came from, which stays visible above it under the overlay.
   Escape, the overlay and a drag down all put it back; the page under it stops scrolling while it is up; the
   keyboard lands in the drawer and goes back to whatever opened it when it closes. Closed, its
   content unmounts, so a form inside it starts fresh the next time.

   A drawer opened from inside another drawer opens as vaul's nested drawer, so the one behind scales back and a
   drag on the question is not also a drag on what asked it. Any drawer, the Add drawer included, provides
   InDrawer to what it holds.

   The bottom padding clears the home indicator (safe-area inset), and vaul's repositionInputs keeps a focused
   field above the iOS keyboard. Nothing registers with the back stack: Back is for screens, not drawers (the
   hand-made Sheet before this did not either). */

/** True inside a drawer: a drawer opened from there nests. */
export const InDrawer = createContext(false);

export default function BottomDrawer({ open, onClose, label, showTitle = false, focus, repositionInputs = true, children }: {
  open: boolean; onClose: () => void;
  /** The drawer's accessible name. Shown as its heading when showTitle is set; otherwise for screen readers only,
      and the content draws its own heading. */
  label: string; showTitle?: boolean;
  /** Where the keyboard lands when the drawer opens — a search box, say, whose whole point is to be typed into at
      once. Otherwise the drawer itself takes focus, so a field does not raise the keyboard uninvited. */
  focus?: React.RefObject<HTMLElement | null>;
  /** Off for a drawer with no text fields. */
  repositionInputs?: boolean;
  children: React.ReactNode;
}) {
  const Root = useContext(InDrawer) ? Vaul.NestedRoot : Drawer;
  const content = useRef<HTMLDivElement>(null);
  /* Where focus was when the drawer opened, so closing puts it back. Radix only returns focus to a DrawerTrigger,
     and these drawers are opened by the caller's own button (and, nested, from inside another drawer). */
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={repositionInputs}>
      <DrawerContent ref={content} tabIndex={-1}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          (focus?.current ?? content.current)?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => {
          const back = opener.current;
          opener.current = null;
          if (back?.isConnected) { e.preventDefault(); back.focus({ preventScroll: true }); }
        }}
        className={cn('max-h-[88dvh] bg-card text-foreground outline-none',
          'data-[vaul-drawer-direction=bottom]:rounded-t-[24px] data-[vaul-drawer-direction=bottom]:border-t-0')}>
        <DrawerTitle className={showTitle ? 'px-[var(--gutter)] pt-3 pb-1 text-xl font-bold' : 'sr-only'}>{label}</DrawerTitle>
        <DrawerDescription className="sr-only">{label}</DrawerDescription>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--gutter)] pt-2 pb-[calc(18px+env(safe-area-inset-bottom))]">
          <InDrawer.Provider value={true}>{children}</InDrawer.Provider>
        </div>
      </DrawerContent>
    </Root>
  );
}
