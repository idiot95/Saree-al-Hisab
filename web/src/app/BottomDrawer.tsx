'use client';

import { createContext, useContext, useRef } from 'react';
import { Drawer as Vaul } from 'vaul';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/* The app's bottom drawer: shadcn's Drawer (vaul) with the few things every drawer here wants, so the call sites
   only say what is in it. It rises over the screen it came from, which stays visible above it under the overlay.
   Escape, the overlay, a drag down and the handle all put it back: the handle across the top edge is a real
   "Close" button (44px, 48 on Android), as Sheet's was, so a screen reader or a switch can dismiss any drawer
   without finishing what is in it. The page under it stops scrolling while it is up; the keyboard lands on Close
   (or on the `focus` field) and goes back to whatever opened the drawer when it closes. Closed, its
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
  const close = useRef<HTMLButtonElement>(null);
  /* A drag that starts on the handle and lets go there is a drag, not a tap: its click must not also close. */
  const grab = useRef<{ x: number; y: number } | null>(null);
  /* Where focus was when the drawer opened, so closing puts it back. Radix only returns focus to a DrawerTrigger,
     and these drawers are opened by the caller's own button (and, nested, from inside another drawer). */
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Root open={open} onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={repositionInputs}>
      <DrawerContent handle={false} aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          (focus?.current ?? close.current)?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => {
          const back = opener.current;
          opener.current = null;
          if (back?.isConnected) { e.preventDefault(); back.focus({ preventScroll: true }); }
        }}
        className={cn('bg-card text-foreground outline-none',
          /* Sheet's height; the same data variant as shadcn's 80vh, so this one wins rather than losing on specificity. */
          'data-[vaul-drawer-direction=bottom]:max-h-[86dvh]',
          'data-[vaul-drawer-direction=bottom]:rounded-t-[24px] data-[vaul-drawer-direction=bottom]:border-t-0')}>
        <DrawerClose ref={close} aria-label="Close"
          onPointerDown={(e) => { grab.current = { x: e.clientX, y: e.clientY }; }}
          onClick={(e) => {
            const g = grab.current; grab.current = null;
            if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 6) e.preventDefault();
          }}
          className="flex min-h-11 w-full flex-none cursor-grab items-center justify-center rounded-t-[24px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset in-data-[platform=android]:min-h-12">
          <span aria-hidden className="h-[5px] w-10 rounded-full bg-border" />
        </DrawerClose>
        <DrawerTitle className={showTitle ? 'px-[var(--gutter)] pb-1 text-xl font-bold' : 'sr-only'}>{label}</DrawerTitle>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--gutter)] pt-2 pb-[calc(18px+env(safe-area-inset-bottom))]">
          <InDrawer.Provider value={true}>{children}</InDrawer.Provider>
        </div>
      </DrawerContent>
    </Root>
  );
}
