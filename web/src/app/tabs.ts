/* The five destinations and who owns what — plain data, kept out of the
   TabBar module on purpose. TabBar is a client component (it ticks the
   phone when a tab is taken), and a server component that imports a value
   from a client module gets a reference to it, not the value. The loading
   skeletons draw a still copy of the bar from this file with no JavaScript
   behind it at all, which is what keeps them free of script tags the CSP
   nonce cannot reach. */

/* Quiet Ledger: every area has a tab. Activity is every entry (with the inbox and what's coming up), Plan is the
   budget and its trends, Money is what you own and owe — accounts, cards, people, net worth. */
export const TABS = [
  { href: '/', label: 'Home', d: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z' },
  { href: '/entries', label: 'Activity', d: 'M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01' },
  { href: '/add', label: 'Add', d: 'M12 5v14M5 12h14' },
  { href: '/budget', label: 'Plan', d: 'M10 3.5A8.5 8.5 0 1 0 20.5 14H12a2 2 0 0 1-2-2zM14 3.6a8.5 8.5 0 0 1 6.4 6.4H14z' },
  { href: '/accounts', label: 'Money', d: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V6a1.5 1.5 0 0 1 1.5-1.5H16M16 13.5h.01' },
] as const;

/* Which tab OWNS a screen that is not itself a tab.

   This was a real orientation bug: /trends, /worth, /people, /household,
   /schedules, /inbox and /guide all passed their own path as `current`, which
   matched no tab, so the whole bar sat grey and the app answered "where am I"
   with "nowhere". Every one of them is opened from a tile on Home, so Home is
   the tab they belong to and the tab that should be lit while you are in one. */
export const OWNED_BY: Record<string, string> = {
  '/inbox': '/entries', '/schedules': '/entries',
  '/trends': '/budget', '/categories': '/budget',
  '/worth': '/accounts', '/people': '/accounts', '/tab': '/accounts',
  '/household': '/', '/guide': '/',
  '/scan': '/add',
};

/** Height of the bar, so pages can leave room for it. */
export const TAB_BAR_SPACE = 'calc(76px + env(safe-area-inset-bottom, 0px))';

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
  const add = t.href === '/add';
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
