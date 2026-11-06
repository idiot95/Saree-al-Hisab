/* The five destinations and who owns what — plain data, kept out of the
   TabBar module on purpose. TabBar is a client component (it ticks the
   phone when a tab is taken), and a server component that imports a value
   from a client module gets a reference to it, not the value. The loading
   skeletons draw a still copy of the bar from this file with no JavaScript
   behind it at all, which is what keeps them free of script tags the CSP
   nonce cannot reach. */

/* Quiet Ledger: every area has a place in the bar, and Add is one of the five slots — a brass tile in the
   middle, one tap from every screen, instead of a button floating over the bar. Activity is every entry (with
   what to review and what's coming up), Loans is what you put down for others and what comes back, and Wealth is
   what you hold: accounts, cards, net worth. The icon is a raw Material Symbols name (see icon-names.ts). */
export type Tab = { href: string; label: string; icon: string; add?: true };
export const TABS: readonly Tab[] = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/entries', label: 'Activity', icon: 'receipt_long' },
  { href: '/add', label: 'Add', icon: 'add', add: true },
  { href: '/people', label: 'Loans', icon: 'group' },
  { href: '/worth', label: 'Wealth', icon: 'account_balance_wallet' },
];

/* Which tab OWNS a screen that is not itself a tab.

   This was a real orientation bug: /trends, /worth, /people, /household,
   /schedules, /inbox and /guide all passed their own path as `current`, which
   matched no tab, so the whole bar sat grey and the app answered "where am I"
   with "nowhere". Every one of them is opened from a tile on Home, so Home is
   the tab they belong to and the tab that should be lit while you are in one. */
export const OWNED_BY: Record<string, string> = {
  '/inbox': '/entries', '/schedules': '/entries', '/entry': '/entries',
  '/budget': '/', '/trends': '/', '/categories': '/',
  '/accounts': '/worth', '/tab': '/people',
  '/household': '/', '/guide': '/',
  '/scan': '/entries',
};

/** Room for the bar, so the last row of a screen is never under it. */
export const TAB_BAR_SPACE = 'calc(76px + env(safe-area-inset-bottom, 0px))';

/** Room at the foot of a screen WITHOUT the bar for the floating Back pill
 *  (Back.tsx), which sits 18px above the safe area and is 44px tall. */
export const BACK_SPACE = 'calc(80px + env(safe-area-inset-bottom, 0px))';

/** Which tab is lit for a screen, and whether it is exactly that screen. */
export function tabLook(t: Tab, current: string) {
  const lit = OWNED_BY[current] ?? current;
  return { on: t.href === lit, here: t.href === current };
}
