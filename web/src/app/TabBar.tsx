import Link from 'next/link';

/* Persistent navigation, in the thumb zone.

   Jakob's Law: every finance app people already use puts its navigation in a
   bar at the bottom, so this one does too. Before it existed you had to walk
   back to the home screen to get anywhere, which is nobody's mental model.

   Fitts's Law: the bar sits at the bottom edge, targets are 60px tall and a
   fifth of the screen wide, and Add — the thing done most often — is centre
   and raised, the easiest target on the screen to hit with a thumb.

   Hick's Law and Miller: five destinations, no more. A sixth would start
   costing more in deliberation than it saves in walking. */

const TABS = [
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
const OWNED_BY: Record<string, string> = {
  '/trends': '/', '/worth': '/', '/people': '/', '/household': '/',
  '/schedules': '/', '/inbox': '/', '/guide': '/', '/books': '/',
  '/scan': '/add', '/categories': '/budget',
};

/** Height of the bar, so pages can leave room for it. */
export const TAB_BAR_SPACE = 'calc(76px + env(safe-area-inset-bottom, 0px))';

export default function TabBar({ current }: { current: string }) {
  /* A screen inside a tab lights that tab, but not as brightly as the tab's
     own screen — you are in Home's territory, not on Home. */
  const owner = OWNED_BY[current];
  const lit = owner ?? current;

  return (
    <nav aria-label="Main" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      background: 'var(--c-card)', borderTop: '1px solid var(--c-border)',
      boxShadow: '0 -1px 12px rgba(35,61,77,.06)',
      /* Anchored: the bar must not slide with the content during a page
         transition, or the one fixed point on the screen moves too. */
      viewTransitionName: 'tab-bar',
    }}>
      {TABS.map((t) => {
        const on = t.href === lit;
        const here = t.href === current;          // exactly this screen
        const add = t.href === '/add';
        return (
          <Link
            key={t.href} href={t.href}
            /* Sideways between tabs — never a forward or back slide. */
            transitionTypes={['nav-lateral']}
            aria-current={here ? 'page' : on ? 'true' : undefined}
            style={{
              flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              textDecoration: 'none', paddingTop: add ? 0 : 6,
              color: on ? 'var(--c-teal)' : 'var(--c-meta)',
              position: 'relative',
            }}
          >
            {/* A rule across the top of the live tab. Colour and weight alone
                were too quiet to read at arm's length in daylight; a bar of
                solid colour at a known place is legible without being looked
                for. Von Restorff: exactly one at a time. */}
            {on && !add && (
              <span aria-hidden style={{
                position: 'absolute', top: 0, left: '22%', right: '22%', height: 3,
                borderRadius: '0 0 3px 3px', background: 'var(--c-teal)',
                opacity: here ? 1 : .45,
              }} />
            )}
            <span style={add ? {
              /* Raised and filled: the one thing done many times a day should
                 not look like the four things done occasionally. */
              width: 46, height: 46, borderRadius: 999, marginTop: -14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              background: 'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.2) 0%, rgba(255,255,255,0) 60%),'
                + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
              boxShadow: '0 4px 14px -4px rgba(35,61,77,.5)',
            } : {
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 26, minWidth: 44, borderRadius: 999,
              /* A tinted pill behind the live tab's glyph — shape as well as
                 colour, so it survives a bright screen and colour blindness. */
              background: here ? 'var(--c-teal-pill)' : 'transparent',
            }}>
              <svg width={add ? 24 : 21} height={add ? 24 : 21} viewBox="0 0 24 24"
                fill={here && !add ? 'var(--c-teal-pill)' : 'none'}
                stroke="currentColor" strokeWidth={add ? 2.4 : on ? 2.2 : 1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.d} />
              </svg>
            </span>
            <span style={{
              fontSize: 'var(--step--2)', fontWeight: on ? 700 : 500, letterSpacing: '.01em',
            }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
