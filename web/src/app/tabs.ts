/* The five destinations and who owns what — plain data, kept out of the
   TabBar module on purpose. TabBar is a client component (it ticks the
   phone when a tab is taken), and a server component that imports a value
   from a client module gets a reference to it, not the value. The loading
   skeletons draw a still copy of the bar from this file with no JavaScript
   behind it at all, which is what keeps them free of script tags the CSP
   nonce cannot reach. */

export const TABS = [
  { href: '/', label: 'Home', d: 'M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z' },
  { href: '/budget', label: 'Budget', d: 'M4.5 19.5V10M9.8 19.5V5M15.2 19.5v-6.5M20.5 19.5V8' },
  { href: '/add', label: 'Add', d: 'M12 5v14M5 12h14' },
  { href: '/entries', label: 'Entries', d: 'M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v13.5L12 16l-7.5 3.5V6A1.5 1.5 0 0 1 6 4.5zM8.5 9h7M8.5 12.5h4' },
  { href: '/accounts', label: 'Accounts', d: 'M3.5 9.5h17M4.5 6.5h15a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6h-15a1.6 1.6 0 0 1-1.6-1.6V8.1a1.6 1.6 0 0 1 1.6-1.6z' },
] as const;

/* Which tab OWNS a screen that is not itself a tab.

   This was a real orientation bug: /trends, /worth, /people, /household,
   /schedules, /inbox and /guide all passed their own path as `current`, which
   matched no tab, so the whole bar sat grey and the app answered "where am I"
   with "nowhere". Every one of them is opened from a tile on Home, so Home is
   the tab they belong to and the tab that should be lit while you are in one. */
export const OWNED_BY: Record<string, string> = {
  '/trends': '/', '/worth': '/', '/people': '/', '/household': '/',
  '/schedules': '/', '/inbox': '/', '/guide': '/', '/books': '/',
  '/scan': '/add', '/categories': '/budget',
};

/** Height of the bar, so pages can leave room for it. */
export const TAB_BAR_SPACE = 'calc(76px + env(safe-area-inset-bottom, 0px))';

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
  background: 'var(--c-card)', borderTop: '1px solid var(--c-border)',
  boxShadow: '0 -1px 12px rgba(35,61,77,.06)',
  /* Anchored: the bar must not slide with the content during a page
     transition, or the one fixed point on the screen moves too. */
  viewTransitionName: 'tab-bar',
} as const;

export function tabStyle(on: boolean, add: boolean) {
  return {
    flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    textDecoration: 'none', paddingTop: add ? 0 : 6,
    color: on ? 'var(--c-teal)' : 'var(--c-meta)',
    position: 'relative',
  } as const;
}
