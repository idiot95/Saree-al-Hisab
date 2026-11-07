'use client';

import { useRef, useState } from 'react';
import Link from '@/app/NavLink';
import { haptic } from './haptics';
import { TABS, tabLook } from './tabs';
import { BAR_CLASS, ADD_TILE_CLASS, slotClass, TabFace } from './TabItem';
import { Icon } from './Icon';
import { openInstant } from './add/instant';

/* Persistent navigation, in the thumb zone.

   Jakob's Law: every finance app people already use puts its navigation in a
   bar at the bottom, so this one does too.

   Fitts's Law: the bar sits at the bottom edge, targets are 64px tall (80 on Android) and a
   fifth of the screen wide, and Add — the thing done most often — is centre,
   the only filled tile in the bar.

   Hick's Law and Miller: five slots, no more. */

/* Screens whose render does more than read (see TabBar's prefetch). */
const NO_PREFETCH = new Set(['/worth']);

export default function TabBar({ current }: { current: string }) {
  /* The tab tapped lights at once, before its screen has arrived: the loading
     frame says where you are going, and the bar should agree with it rather
     than keep pointing at the screen being left. Remembered against the
     screen it was tapped on, so arriving (a new `current`) clears it with no
     effect to run. */
  const [tapped, setTapped] = useState<{ from: string; href: string } | null>(null);
  /* Whether the finger that lit a tab has lifted yet, and where: a touch that ends anywhere but on the tab it lit
     (a drag off the bar, a pointer that leaves while down, a cancel) puts the bar back. */
  const lifted = useRef<'no' | 'inside'>('no');
  const showing = tapped && tapped.from === current ? tapped.href : current;
  /* Which way a tab switch moves: towards the tab chosen, measured from the
     one lit now. From a screen no tab owns, it is a plain lateral fade. */
  const litAt = TABS.findIndex((t) => tabLook(t, current).on);
  return (
    <nav aria-label="Main" className={BAR_CLASS}>
      {TABS.map((t, i) => {
        if (t.add) {
          /* Straight to a new entry — the drawer over this screen. It opens on the tap, from the pickers this phone
             already holds (add/instant.ts), while the link fetches /add (app/@modal/(.)add) behind it. No view
             transition: the screen underneath does not change, and one would freeze the drawer being typed into.
             A modified click (a new tab) is left to the browser. */
          return (
            <span key={t.href} className="flex h-full flex-1 items-center justify-center">
              <Link href="/add" aria-label="Add an entry" pressNow
                onClick={(e) => {
                  haptic('tap');
                  // Offline, the link goes to /add and the worker answers with /offline, as before: nothing to open here.
                  if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && navigator.onLine) openInstant();
                }} className={`press ${ADD_TILE_CLASS}`}>
                <Icon name={t.icon} size={28} />
              </Link>
            </span>
          );
        }
        const { on, here } = tabLook(t, showing);
        /* Which way the frame comes on: towards the tab chosen, measured from the one lit now; from a screen no tab
           owns, a plain fade. Sideways between tabs — never a push or a pop. */
        const motion = litAt < 0 || i === litAt ? 'fade' : i > litAt ? 'tab-right' : 'tab-left';
        const take = () => { if (!here) setTapped({ from: current, href: t.href }); };
        const putBack = () => setTapped((was) => (was?.href === t.href ? null : was));
        return (
          <Link
            key={t.href} href={t.href} motion={motion} pressNow
            /* Tapped all day, so each other tab is fetched whole as the bar comes into view: the tap then needs no
               server render at all (NavLink). Not the tab of the screen already here, and not Wealth: its render
               refreshes the day's exchange and metal rates (calls to the price providers and a write), which must
               happen when the person opens it, never because a bar scrolled into view. */
            prefetch={!tabLook(t, current).here && !NO_PREFETCH.has(t.href)}
            aria-current={here ? 'page' : on ? 'true' : undefined}
            /* Lit as the finger lands, before the screen has arrived. Put back if the touch ends anywhere but on this
               tab: lifted outside it, left while still down, or taken back by the browser (a drag, a scroll). A lift
               on it is left lit: the click that follows navigates. */
            onPointerDown={(e) => { if (e.button === 0) { lifted.current = 'no'; take(); } }}
            onPointerUp={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
              lifted.current = on ? 'inside' : 'no';
              if (!on) putBack();
            }}
            onPointerLeave={() => { if (lifted.current !== 'inside') putBack(); }}
            onLostPointerCapture={() => { if (lifted.current !== 'inside') putBack(); }}
            onPointerCancel={putBack}
            /* A tick under the thumb as the tab is taken — the moment of the tap, not the moment the screen arrives. */
            onClick={() => { if (!here) { haptic('tap'); take(); } }}
            className={`press ${slotClass(on)}`}
          >
            <TabFace t={t} on={on} here={here} live />
          </Link>
        );
      })}
    </nav>
  );
}
