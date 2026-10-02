'use client';

import { useRouter } from 'next/navigation';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';

/* Vaul's drawer around Add Entry: springs up, follows a drag on the handle, and closing it — drag, Escape, the veil —
   is a step back in history, so the screen underneath is exactly where it was. */
export default function AddDrawer({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Drawer open onOpenChange={(open) => { if (!open) router.back(); }}>
      <DrawerContent className="max-h-[94dvh] bg-background">
        <DrawerTitle className="sr-only">New entry</DrawerTitle>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
