import { TABS, BAR_STYLE, TAB_BAR_SPACE, tabLook, tabStyle } from './tabs';
import { TabGlyph } from './TabGlyph';

/* What a screen looks like in the moment between the tap and the data.

   Before this there was nothing: every page is `force-dynamic`, so a tap sat
   on the OLD screen — unchanged, unmarked — until Singapore answered. Two
   hundred milliseconds of a screen that has not acknowledged being touched
   reads as a slow app, and the Doherty threshold is the reason: past about
   400ms attention wanders, and an interface that has not responded AT ALL is
   worse than one that responded with very little.

   So the header arrives instantly, complete and correct — paper, its real
   title where the title is known before the data, the tab's switch — and the body is
   drawn in the shape the screen will have: a list is rows, a form is fields,
   a tab is its figure, its people and its two buttons. You know where you are
   before you know what it says, which is the right order.

   Plain markup, no hooks, so the same frames serve two masters: the route's
   loading.tsx (what the server streams first) and PendingSkeleton (what the
   phone draws the instant a link is tapped, before the server has answered
   at all). `frameFor` is the one place that knows which screen gets which. */

function Bar({ w, h = 13, r = 6, o = 1 }: { w: string | number; h?: number; r?: number; o?: number }) {
  return <span className="shim" style={{ display: 'block', width: w, height: h, borderRadius: r, opacity: o, flex: 'none' }} />;
}

export type Frame = {
  /** The screen's name when it is known before the data; null draws where a name will be. */
  title: string | null;
  /** The tab that owns the screen, for the still tab bar; null on screens without the bar. */
  current: string | null;
  rows?: number;
  /** A small line above the title — "Reconcile" over the account's name. */
  eyebrow?: string;
  /** How many views the tab's segmented switch has (Activity 3, Plan 2, Money 3); 0 for none. */
  segments?: number;
  /** A screen pushed on top of a tab: it gets a back arrow, not a switch. */
  back?: boolean;
  /** The big figure a tab, a person or a balance leads with. */
  figure?: boolean;
  /** Chips in the header — the people on a tab. */
  chips?: number;
  /** A form card before the rows. */
  form?: boolean;
  /** The two buttons pinned under the thumb. */
  footer?: boolean;
};

/* The Quiet Ledger header, drawn: paper, the serif title, and the switch or the back arrow the screen will have. */
function Head({ title, eyebrow, segments = 0, back = false, chips = 0 }: Frame) {
  return (
    <header style={{ padding: '16px var(--gutter) 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {back && (
        <span style={{ width: 44, height: 44, marginLeft: -11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="var(--foreground)"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </span>
      )}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {eyebrow && <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{eyebrow}</span>}
        {/* The title is real where it can be. It is the whole point: the
            question "did my tap register, and where am I going" is answered
            before any data has moved. */}
        {title
          ? <h1 className="font-display" style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontWeight: 400 }}>{title}</h1>
          : <Bar w="52%" h={28} r={8} />}
        <Bar w="38%" h={11} o={.6} />
      </span>
      {segments > 0 && (
        <span style={{ display: 'grid', gridTemplateColumns: `repeat(${segments}, 1fr)`, gap: 4, padding: 4, borderRadius: 14, background: 'var(--muted)' }}>
          {Array.from({ length: segments }, (_, i) => (
            <span key={i} style={{ height: 44, borderRadius: 11, background: i === 0 ? 'var(--card)' : 'transparent' }} />
          ))}
        </span>
      )}
      {chips > 0 && (
        <span style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: chips }, (_, i) => <span key={i} className="shim" style={{ width: 92 - i * 8, height: 44, borderRadius: 999 }} />)}
        </span>
      )}
    </header>
  );
}

const CARD: React.CSSProperties = { borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)' };

export default function Skeleton({
  title, current, rows = 4, eyebrow, segments = 0, back = false, figure = false, chips = 0, form = false, footer = false,
  stillBar = true,
}: Frame & { stillBar?: boolean }) {
  return (
    <main style={{
      minHeight: '100dvh', background: 'var(--background)', color: 'var(--foreground)',
      paddingBottom: current ? TAB_BAR_SPACE : footer ? 104 : 44,
    }}>
      <Head title={title} current={current} eyebrow={eyebrow} segments={segments} back={back} chips={chips} />
      <div style={{ padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 14 }}
        aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading {title ?? 'the screen'}</span>
        {figure && (
          <div style={{ ...CARD, borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Bar w="26%" h={10} o={.7} />
            <Bar w="52%" h={36} r={9} />
            <Bar w="72%" h={10} o={.6} />
          </div>
        )}
        {form && (
          <div style={{ ...CARD, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Bar w="28%" h={10} o={.7} />
            <span className="shim" style={{ height: 58, borderRadius: 14 }} />
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bar w={`${34 - i * 6}%`} h={10} o={.7} />
                <span className="shim" style={{ height: 48, borderRadius: 13 }} />
              </span>
            ))}
            <span className="shim" style={{ height: 54, borderRadius: 15, marginTop: 2 }} />
          </div>
        )}
        {rows > 0 && (
          <div style={{ ...CARD, padding: '0 16px' }}>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
                borderBottom: i === rows - 1 ? undefined : '1px solid var(--border)',
              }}>
                <span className="shim" style={{ width: 36, height: 36, borderRadius: 10, flex: 'none' }} />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Bar w={`${62 - i * 7}%`} />
                  <Bar w={`${40 - i * 4}%`} h={10} o={.6} />
                </span>
                <Bar w={62} h={15} />
              </div>
            ))}
          </div>
        )}
      </div>

      {footer && (
        <div aria-hidden style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, display: 'flex', gap: 9,
          padding: '12px var(--gutter) calc(14px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--background)', borderTop: '1px solid var(--border)',
        }}>
          <span className="shim" style={{ flex: 1, height: 54, borderRadius: 15 }} />
          <span className="shim" style={{ flex: 1.3, height: 54, borderRadius: 15 }} />
        </div>
      )}
      {current && stillBar && <StillTabBar current={current} />}
    </main>
  );
}

/** Home: the month and household, the ring card, the two tiles, today's list. */
export function HomeSkeleton({ stillBar = true }: { stillBar?: boolean }) {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--background)', paddingBottom: TAB_BAR_SPACE }}>
      <header style={{ padding: '16px var(--gutter)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Bar w="30%" h={11} o={.6} />
          <Bar w="64%" h={28} r={8} />
        </span>
        <span className="shim" style={{ width: 44, height: 44, borderRadius: 999, flex: 'none' }} />
      </header>
      <div style={{ padding: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 14 }}
        aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading home</span>
        <div style={{ ...CARD, borderRadius: 22, padding: 16, display: 'flex', alignItems: 'center', gap: 16, minHeight: 150 }}>
          <span className="shim" style={{ width: 96, height: 96, borderRadius: 999, flex: 'none' }} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Bar w="44%" h={10} o={.7} />
            <Bar w="78%" h={36} r={9} />
            <Bar w="64%" h={10} o={.6} />
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[0, 1].map((i) => (
            <span key={i} style={{ ...CARD, minHeight: 72, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Bar w="54%" h={10} o={.6} />
              <Bar w="70%" h={16} />
            </span>
          ))}
        </div>
        <div style={{ ...CARD, padding: '0 16px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 68, borderBottom: i === 2 ? undefined : '1px solid var(--border)' }}>
              <span className="shim" style={{ width: 36, height: 36, borderRadius: 10, flex: 'none' }} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <Bar w={`${58 - i * 8}%`} />
                <Bar w={`${38 - i * 4}%`} h={10} o={.6} />
              </span>
              <Bar w={56} h={15} />
            </div>
          ))}
        </div>
      </div>
      {stillBar && <StillTabBar current="/" />}
    </main>
  );
}

const ID = '[^/]+';
const is = (path: string, pattern: string) => new RegExp(`^${pattern}/?$`).test(path);

/** Which frame a path gets, or null for a screen that draws none (sign-in and friends). */
export function frameFor(path: string): Frame | 'home' | null {
  if (path === '/') return 'home';
  if (is(path, '/entries') || is(path, '/inbox') || is(path, '/schedules')) return { title: 'Activity', current: '/entries', segments: 3, rows: 6 };
  if (is(path, `/entries/${ID}`)) return { title: 'Entry', current: null, back: true, rows: 0, form: true };
  if (is(path, '/budget') || is(path, '/trends')) return { title: 'Plan', current: '/budget', segments: 2, rows: 5, figure: true };
  if (is(path, '/categories')) return { title: 'Categories', current: '/budget', back: true, rows: 6 };
  if (is(path, '/accounts') || is(path, '/people') || is(path, '/worth')) return { title: 'Money', current: '/accounts', segments: 3, rows: 4, figure: true };
  if (is(path, '/accounts/reconcile')) return { title: 'Reconcile', current: '/accounts', back: true, rows: 4 };
  if (is(path, `/accounts/${ID}/reconcile`)) return { title: null, eyebrow: 'Reconcile', current: null, back: true, rows: 3, form: true };
  if (is(path, `/people/${ID}`)) return { title: null, current: null, back: true, rows: 4, figure: true };
  if (is(path, `/tab/${ID}`)) return { title: null, current: null, back: true, rows: 4, figure: true, chips: 3, footer: true };
  if (is(path, '/household')) return { title: 'Household', current: '/', back: true, rows: 3 };
  if (is(path, '/guide')) return { title: 'How it works', current: '/', back: true, rows: 4 };
  if (is(path, '/add')) return { title: 'New entry', current: null, rows: 0, form: true };
  if (is(path, '/scan')) return { title: 'Scan a receipt', current: null, back: true, rows: 0, form: true };
  return null;
}

/** The frame for a path, drawn. */
export function SkeletonFor({ path, stillBar = true }: { path: string; stillBar?: boolean }) {
  const f = frameFor(path);
  if (!f) return null;
  return f === 'home' ? <HomeSkeleton stillBar={stillBar} /> : <Skeleton {...f} stillBar={stillBar} />;
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
