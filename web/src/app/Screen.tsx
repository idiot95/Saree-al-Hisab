import { ViewTransition } from 'react';

/* Every screen is wrapped in this, and it is what makes navigation legible.

   The complaint it answers was "I cannot tell where I am". Half of that was
   the tab bar lighting nothing on seven screens, fixed in TabBar. The other
   half is that every route change was an instant swap: forward and back looked
   identical, so nothing told you whether you had gone deeper into the app or
   come back out of it.

   Horizontal direction is the oldest convention there is for this — a page
   turns left to go forward and right to come back — and it is strong enough
   that violating it reads as a bug. So a link that goes deeper is tagged
   `nav-forward` and slides the old screen out to the left; a link that comes
   back is tagged `nav-back` and slides it right.

   Moving between tabs is neither of those — it is sideways, at the same
   depth — so a slide would be a lie about the shape of the app. Those get a
   fade-through with a slight lift instead, which reads as "same level, new
   place". Three motions, each meaning one thing.

   `default: 'none'` matters. Without it, every untyped transition — the
   browser's own back button, a router.refresh(), a Suspense boundary
   resolving — would fire a directional slide in whichever direction was last
   used, which is worse than no animation because it is confidently wrong. */

const DIRECTIONAL = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  'nav-lateral': 'nav-lateral',
  default: 'none',
} as const;

export default function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL} exit={DIRECTIONAL} default="none">
      {children}
    </ViewTransition>
  );
}
