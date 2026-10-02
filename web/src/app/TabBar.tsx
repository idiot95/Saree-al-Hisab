'use client';

import { useState } from 'react';
import Link from '@/app/NavLink';
import { haptic } from './haptics';
import { TABS, BAR_STYLE, ADD_FAB, PLUS, tabLook, tabStyle } from './tabs';
import { TabGlyph } from './TabGlyph';

/* Persistent navigation, in the thumb zone.

   Jakob's Law: every finance app people already use puts its navigation in a
   bar at the bottom, so this one does too. Before it existed you had to walk
   back to the home screen to get anywhere, which is nobody's mental model.

   Fitts's Law: the bar sits at the bottom edge, targets are 60px tall and a
   fifth of the screen wide, and Add — the thing done most often — is centre
   and raised, the easiest target on the screen to hit with a thumb.

   Hick's Law and Miller: five destinations, no more. A sixth would start
   costing more in deliberation than it saves in walking. */

export default function TabBar({ current }: { current: string }) {
  /* The plus goes straight to a new entry — the drawer over this screen
     (app/@modal/(.)add). It floats above the bar rather than sitting in it, so
     Loans could have the fifth tab. */
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
    <>
    <Link href="/add" transitionTypes={['nav-lateral']} aria-label="Add an entry" className="press"
      onClick={() => haptic('tap')} style={ADD_FAB}>
      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}
        strokeLinecap="round" aria-hidden><path d={PLUS} /></svg>
    </Link>
    <nav aria-label="Main" style={BAR_STYLE}>
      {TABS.map((t) => {
        /* A screen inside a tab lights that tab, but not as brightly as the
           tab's own screen — you are in Home's territory, not on Home. */
        const { on, here, add } = tabLook(t, showing);
        const i = TABS.indexOf(t);
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
            className="press"
            style={tabStyle(on, add)}
          >
            <TabGlyph t={t} on={on} here={here} add={add} live />
          </Link>
        );
      })}
    </nav>
    </>
  );
}
