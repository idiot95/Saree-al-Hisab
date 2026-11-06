'use client';

import { useState } from 'react';
import Link from '@/app/NavLink';
import { haptic } from './haptics';
import { TABS, tabLook } from './tabs';
import { BAR_CLASS, ADD_TILE_CLASS, slotClass, TabFace } from './TabItem';
import { Icon } from './Icon';

/* Persistent navigation, in the thumb zone.

   Jakob's Law: every finance app people already use puts its navigation in a
   bar at the bottom, so this one does too.

   Fitts's Law: the bar sits at the bottom edge, targets are 76px tall and a
   fifth of the screen wide, and Add — the thing done most often — is centre,
   the only filled tile in the bar.

   Hick's Law and Miller: five slots, no more. */

export default function TabBar({ current }: { current: string }) {
  /* The tab tapped lights at once, before its screen has arrived: the loading
     frame says where you are going, and the bar should agree with it rather
     than keep pointing at the screen being left. Remembered against the
     screen it was tapped on, so arriving (a new `current`) clears it with no
     effect to run. */
  const [tapped, setTapped] = useState<{ from: string; href: string } | null>(null);
  const showing = tapped && tapped.from === current ? tapped.href : current;
  /* Which way a tab switch moves: towards the tab chosen, measured from the
     one lit now. From a screen no tab owns, it is a plain lateral fade. */
  const litAt = TABS.findIndex((t) => tabLook(t, current).on);
  return (
    <nav aria-label="Main" className={BAR_CLASS}>
      {TABS.map((t, i) => {
        if (t.add) {
          /* Straight to a new entry — the drawer over this screen (app/@modal/(.)add). */
          return (
            <span key={t.href} className="flex h-full flex-1 items-center justify-center">
              <Link href="/add" transitionTypes={['nav-lateral']} aria-label="Add an entry"
                onClick={() => haptic('tap')} className={`press ${ADD_TILE_CLASS}`}>
                <Icon name={t.icon} size={28} />
              </Link>
            </span>
          );
        }
        const { on, here } = tabLook(t, showing);
        const motion = litAt < 0 || i === litAt ? 'nav-lateral' : i > litAt ? 'nav-tab-right' : 'nav-tab-left';
        return (
          <Link
            key={t.href} href={t.href}
            /* Sideways between tabs — never a forward or back slide. */
            transitionTypes={[motion]}
            aria-current={here ? 'page' : on ? 'true' : undefined}
            /* A tick under the thumb as the tab is taken — the moment of the
               tap, not the moment the screen arrives. */
            onClick={() => { if (!here) { haptic('tap'); setTapped({ from: current, href: t.href }); } }}
            className={`press ${slotClass(on)}`}
          >
            <TabFace t={t} on={on} here={here} live />
          </Link>
        );
      })}
    </nav>
  );
}
