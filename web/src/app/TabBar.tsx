'use client';

import Link from 'next/link';
import { haptic } from './haptics';
import { TABS, BAR_STYLE, tabLook, tabStyle } from './tabs';
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
  return (
    <nav aria-label="Main" style={BAR_STYLE}>
      {TABS.map((t) => {
        /* A screen inside a tab lights that tab, but not as brightly as the
           tab's own screen — you are in Home's territory, not on Home. */
        const { on, here, add } = tabLook(t, current);
        return (
          <Link
            key={t.href} href={t.href}
            /* Sideways between tabs — never a forward or back slide. */
            transitionTypes={['nav-lateral']}
            aria-current={here ? 'page' : on ? 'true' : undefined}
            /* A tick under the thumb as the tab is taken — the moment of the
               tap, not the moment the screen arrives. */
            onClick={() => { if (!here) haptic('tap'); }}
            className="press"
            style={tabStyle(on, add)}
          >
            <TabGlyph t={t} on={on} here={here} add={add} />
          </Link>
        );
      })}
    </nav>
  );
}
