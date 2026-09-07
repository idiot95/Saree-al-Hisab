import { headerBg, type Accent } from './auth-ui';
import { TABS, BAR_STYLE, TAB_BAR_SPACE, tabLook, tabStyle } from './tabs';
import { TabGlyph } from './TabGlyph';

/* What a screen looks like in the moment between the tap and the data.

   Before this there was nothing: every page is `force-dynamic`, so a tap sat
   on the OLD screen — unchanged, unmarked — until Singapore answered. Two
   hundred milliseconds of a screen that has not acknowledged being touched
   reads as a slow app, and the Doherty threshold is the reason: past about
   400ms attention wanders, and an interface that has not responded AT ALL is
   worse than one that responded with very little.

   So the header arrives instantly, complete and correct — its real colour,
   its real title — and only the figures are still on their way. You know
   where you are before you know what it says, which is the right order.

   This is also what makes the route prefetchable: a Suspense boundary gives
   Next a static shell to fetch ahead of the tap, so on a warm cache the
   header is already on the device before a finger lands. */

function Bar({ w, h = 13, r = 6, o = 1 }: { w: string | number; h?: number; r?: number; o?: number }) {
  return <span className="shim" style={{ display: 'block', width: w, height: h, borderRadius: r, opacity: o }} />;
}

export default function Skeleton({ accent, title, current, rows = 4 }: {
  accent: Accent; title: string; current: string; rows?: number;
}) {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: headerBg(accent), color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 11,
      }}>
        <span style={{ width: 44, height: 44, marginLeft: -11, display: 'flex', alignItems: 'center' }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.92)"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </span>
        {/* The title is real, not a grey block. It is the whole point: the
            question "did my tap register, and where am I going" is answered
            before any data has moved. */}
        <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>{title}</h1>
      </header>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}
        aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading {title}</span>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="el" style={{
            borderRadius: 15, background: 'var(--c-card)', border: '1px solid var(--c-border)',
            padding: '15px 14px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span className="shim" style={{ width: 40, height: 40, borderRadius: 11, flex: 'none' }} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Bar w={`${58 - i * 6}%`} />
              <Bar w={`${38 - i * 4}%`} h={10} o={.6} />
            </span>
            <Bar w={62} h={15} />
          </div>
        ))}
      </div>
      <StillTabBar current={current} />
    </main>
  );
}

/* The tab bar, drawn but not wired. It is on screen for the two hundred
   milliseconds before the real one arrives with the page, and it shares the
   real one's view-transition name so the swap is invisible.

   Why not the real one: TabBar is a client component, and a client component
   inside a loading boundary makes Next write its chunk into the page as a
   plain <script> that never gets the CSP nonce — which the policy then
   refuses, correctly, and logs. A bar made of nothing but markup has no
   chunk to write. */
function StillTabBar({ current }: { current: string }) {
  return (
    <nav aria-hidden style={BAR_STYLE}>
      {TABS.map((t) => {
        const { on, here, add } = tabLook(t, current);
        return (
          <span key={t.href} style={tabStyle(on, add)}>
            <TabGlyph t={t} on={on} here={here} add={add} />
          </span>
        );
      })}
    </nav>
  );
}
