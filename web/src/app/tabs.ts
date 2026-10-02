/* The five destinations and who owns what — plain data, kept out of the
   TabBar module on purpose. TabBar is a client component (it ticks the
   phone when a tab is taken), and a server component that imports a value
   from a client module gets a reference to it, not the value. The loading
   skeletons draw a still copy of the bar from this file with no JavaScript
   behind it at all, which is what keeps them free of script tags the CSP
   nonce cannot reach. */

/* Quiet Ledger: every area has a tab. Activity is every entry (with what to review and what's coming up), Plan is
   the budget and its trends, Loans is what you put down for others and what comes back — a household's khata is
   used daily, so it has a tab of its own — and Money is what you hold: accounts, cards, net worth. Add is not a
   tab: it floats above the bar (ADD_FAB), one tap from every screen. */
export const TABS = [
  { href: '/', label: 'Home', d: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z' },
  { href: '/entries', label: 'Activity', d: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01' },
  { href: '/budget', label: 'Plan', d: 'M10 3.5A8.5 8.5 0 1 0 20.5 14H12a2 2 0 0 1-2-2zM14 3.6a8.5 8.5 0 0 1 6.4 6.4H14z' },
  { href: '/people', label: 'Loans', d: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.2a3.5 3.5 0 0 1 0 6.6M21 20v-1.5a4.5 4.5 0 0 0-3-4.2' },
  { href: '/accounts', label: 'Money', d: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V6a1.5 1.5 0 0 1 1.5-1.5H16M16 13.5h.01' },
] as const;

/* Which tab OWNS a screen that is not itself a tab.

   This was a real orientation bug: /trends, /worth, /people, /household,
   /schedules, /inbox and /guide all passed their own path as `current`, which
   matched no tab, so the whole bar sat grey and the app answered "where am I"
   with "nowhere". Every one of them is opened from a tile on Home, so Home is
   the tab they belong to and the tab that should be lit while you are in one. */
export const OWNED_BY: Record<string, string> = {
  '/inbox': '/entries', '/schedules': '/entries', '/entry': '/entries',
  '/trends': '/budget', '/categories': '/budget',
  '/worth': '/accounts', '/tab': '/people',
  '/household': '/', '/guide': '/',
  '/scan': '/entries',
};

/** Room for the bar and the Add button floating over its right end, so the last row is never under either. */
export const TAB_BAR_SPACE = 'calc(144px + env(safe-area-inset-bottom, 0px))';

/* Add, floating: marigold, round, above the bar's right end — where the thumb rests and where every phone app
   keeps its one main action. 56px, so it is the biggest target on the screen (Fitts), and the only filled one
   (Von Restorff). Anchored like the bar, so a page transition does not carry it off. */
export const ADD_FAB = {
  position: 'fixed', right: 16, zIndex: 41,
  bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  width: 58, height: 58, borderRadius: 999,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--attention)', color: 'var(--attention-foreground)',
  boxShadow: '0 10px 24px -10px rgba(16,24,40,.45), 0 2px 6px rgba(16,24,40,.12)',
  viewTransitionName: 'add-fab',
} as const;

export const PLUS = 'M12 5v14M5 12h14';

/** Room at the foot of a screen WITHOUT the bar for the floating Back pill
 *  (Back.tsx), which sits 18px above the safe area and is 44px tall. */
export const BACK_SPACE = 'calc(80px + env(safe-area-inset-bottom, 0px))';

/* Everything about how one tab looks, shared by the live bar and its still
   copy so the two are the same to the pixel and the swap between them is
   invisible. */
export function tabLook(t: (typeof TABS)[number], current: string) {
  const owner = OWNED_BY[current];
  const lit = owner ?? current;
  const on = t.href === lit;
  const here = t.href === current;          // exactly this screen
  const add = false;                       // Add floats above the bar now (ADD_FAB), never a tab
  return { on, here, add };
}

export const BAR_STYLE = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
  display: 'flex', alignItems: 'stretch',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: 'var(--card)', borderTop: '1px solid var(--border)',
  /* Anchored: the bar must not slide with the content during a page
     transition, or the one fixed point on the screen moves too. */
  viewTransitionName: 'tab-bar',
} as const;

export function tabStyle(on: boolean, add: boolean) {
  return {
    flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    textDecoration: 'none', paddingTop: add ? 0 : 6,
    color: on ? 'var(--primary)' : 'var(--muted-foreground)',
    position: 'relative',
  } as const;
}
