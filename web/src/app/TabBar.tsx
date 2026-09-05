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
  { href: '/accounts', label: 'Accounts', d: 'M3.5 9.5h17M4.5 6.5h15a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6h-15a1.6 1.6 0 0 1-1.6-1.6V8.1a1.6 1.6 0 0 1 1.6-1.6z' },
  { href: '/household', label: 'Household', d: 'M9 11.7a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM3 19.5a6 6 0 0 1 12 0M16 5.6a3.2 3.2 0 0 1 0 5.8M17 14.2a6 6 0 0 1 4 5.3' },
] as const;

/** Height of the bar, so pages can leave room for it. */
export const TAB_BAR_SPACE = 'calc(76px + env(safe-area-inset-bottom, 0px))';

export default function TabBar({ current }: { current: string }) {
  return (
    <nav aria-label="Main" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      background: 'var(--c-card)', borderTop: '1px solid var(--c-border)',
      boxShadow: '0 -1px 12px rgba(35,61,77,.06)',
    }}>
      {TABS.map((t) => {
        const on = t.href === current;
        const add = t.href === '/add';
        return (
          <Link
            key={t.href} href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              textDecoration: 'none', paddingTop: add ? 0 : 6,
              color: on ? 'var(--c-teal)' : 'var(--c-meta)',
            }}
          >
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
              display: 'flex', alignItems: 'center', justifyContent: 'center', height: 22,
            }}>
              <svg width={add ? 24 : 21} height={add ? 24 : 21} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={add ? 2.4 : on ? 2.1 : 1.8}
                strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.d} />
              </svg>
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: '.01em',
            }}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
