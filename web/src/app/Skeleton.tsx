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
   its real title where the title is known before the data — and the body is
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

/** A placeholder on a coloured header, where the grey shimmer would read as a hole. */
function Light({ w, h = 14, r = 7 }: { w: string | number; h?: number; r?: number }) {
  return <span style={{ display: 'block', width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,.2)', flex: 'none' }} />;
}

export type Frame = {
  accent: Accent;
  /** The screen's name when it is known before the data; null draws where a name will be. */
  title: string | null;
  /** The tab that owns the screen, for the still tab bar; null on screens without the bar. */
  current: string | null;
  rows?: number;
  /** A small line above the title — "Reconcile" over the account's name. */
  eyebrow?: string;
  /** The big figure a tab, a person or a balance leads with. */
  figure?: boolean;
  /** Chips in the header — the people on a tab. */
  chips?: number;
  /** A form card before the rows. */
  form?: boolean;
  /** The two buttons pinned under the thumb. */
  footer?: boolean;
};

export default function Skeleton({
  accent, title, current, rows = 4, eyebrow, figure = false, chips = 0, form = false, footer = false,
  stillBar = true,
}: Frame & { stillBar?: boolean }) {
  return (
    <main style={{
      minHeight: '100dvh', background: 'var(--c-bg)',
      paddingBottom: current ? TAB_BAR_SPACE : footer ? 104 : 44,
    }}>
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
        {eyebrow && <span style={{ fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.72)' }}>{eyebrow}</span>}
        {/* The title is real where it can be. It is the whole point: the
            question "did my tap register, and where am I going" is answered
            before any data has moved. */}
        {title
          ? <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>{title}</h1>
          : <Light w="52%" h={24} r={8} />}
        {figure && <Light w="38%" h={32} r={9} />}
        {figure && <Light w="72%" h={11} />}
        {chips > 0 && (
          <span style={{ display: 'flex', gap: 8, marginTop: 2 }}>
            {Array.from({ length: chips }, (_, i) => (
              <span key={i} style={{ width: 92 - i * 8, height: 44, borderRadius: 999, background: 'rgba(255,255,255,.13)' }} />
            ))}
          </span>
        )}
      </header>

      <div style={{ padding: '16px var(--gutter) 0', display: 'flex', flexDirection: 'column', gap: 12 }}
        aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading {title ?? 'the screen'}</span>
        {form && (
          <div className="el card" style={{
            borderRadius: 18, background: 'var(--c-card)', padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
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
          <div className="el card" style={{
            borderRadius: 18, background: 'var(--c-card)', padding: '0 var(--pad)',
          }}>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 68,
                borderBottom: i === rows - 1 ? undefined : '1px solid var(--c-rule)',
              }}>
                <span className="shim" style={{ width: 40, height: 40, borderRadius: 11, flex: 'none' }} />
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
          background: 'var(--c-bg)', borderTop: '1px solid var(--c-border)',
        }}>
          <span className="shim" style={{ flex: 1, height: 54, borderRadius: 15 }} />
          <span className="shim" style={{ flex: 1.3, height: 54, borderRadius: 15 }} />
        </div>
      )}
      {current && stillBar && <StillTabBar current={current} />}
    </main>
  );
}

/** Home: the household header, the deck's card, its dots, and the tiles. */
export function HomeSkeleton({ stillBar = true }: { stillBar?: boolean }) {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: headerBg('teal'), color: '#fff', borderRadius: '0 0 26px 26px',
        padding: '12px var(--gutter) 16px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 50 }}>
          <span style={{ width: 38, height: 38, borderRadius: 999, background: 'rgba(255,255,255,.16)', flex: 'none' }} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Light w="48%" h={15} />
            <Light w="32%" h={10} />
          </span>
          <span style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,.12)', flex: 'none' }} />
        </span>
        <span style={{ height: 22 }} />
      </header>
      <div style={{ padding: '18px var(--gutter) 0', display: 'flex', flexDirection: 'column', gap: 14 }}
        aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading home</span>
        <div className="el2" style={{
          borderRadius: 22, background: 'var(--c-card)', border: '1px solid var(--c-border)',
          padding: '18px 17px', display: 'flex', flexDirection: 'column', gap: 13, minHeight: 232,
        }}>
          <Bar w="38%" h={17} />
          <Bar w="54%" h={32} r={9} />
          <Bar w="66%" h={10} o={.6} />
          <span className="shim" style={{ height: 10, borderRadius: 999, marginTop: 6 }} />
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="shim" style={{ width: 26, height: 26, borderRadius: 7, flex: 'none' }} />
              <span style={{ flex: 1 }}><Bar w={`${58 - i * 8}%`} h={11} /></span>
              <Bar w={54} h={11} />
            </span>
          ))}
        </div>
        <span style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          {[18, 7, 7].map((w, i) => <span key={i} className="shim" style={{ width: w, height: 7, borderRadius: 999 }} />)}
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="el" style={{
              minHeight: 92, borderRadius: 16, background: 'var(--c-card)', border: '1px solid var(--c-border)',
              padding: '12px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8,
            }}>
              <span className="shim" style={{ width: 32, height: 32, borderRadius: 9 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Bar w="62%" h={12} />
                <Bar w="44%" h={9} o={.6} />
              </span>
            </span>
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
  if (is(path, '/entries')) return { accent: 'indigo', title: 'Entries', current: '/entries', rows: 6 };
  if (is(path, `/entries/${ID}`)) return { accent: 'indigo', title: 'Entry', current: null, rows: 0, form: true };
  if (is(path, '/budget')) return { accent: 'gold', title: 'Budget', current: '/budget', rows: 5 };
  if (is(path, '/categories')) return { accent: 'gold', title: 'Categories', current: '/categories', rows: 6 };
  if (is(path, '/accounts')) return { accent: 'blue', title: 'Accounts', current: '/accounts', rows: 4 };
  if (is(path, '/accounts/reconcile')) return { accent: 'blue', title: 'Reconcile', current: '/accounts', rows: 4 };
  if (is(path, `/accounts/${ID}/reconcile`)) return { accent: 'blue', title: null, eyebrow: 'Reconcile', current: null, rows: 3, form: true };
  if (is(path, '/people')) return { accent: 'purple', title: 'Loan centre', current: '/people', rows: 4, figure: true };
  if (is(path, `/people/${ID}`)) return { accent: 'purple', title: null, current: null, rows: 4, figure: true };
  if (is(path, `/tab/${ID}`)) return { accent: 'purple', title: null, current: null, rows: 4, figure: true, chips: 3, footer: true };
  if (is(path, '/trends')) return { accent: 'green', title: 'Trends', current: '/trends', rows: 3 };
  if (is(path, '/worth')) return { accent: 'green', title: 'Net worth', current: '/worth', rows: 4, figure: true };
  if (is(path, '/inbox')) return { accent: 'pumpkin', title: 'Inbox', current: '/inbox', rows: 3 };
  if (is(path, '/schedules')) return { accent: 'cyan', title: 'Scheduled', current: '/schedules', rows: 4 };
  if (is(path, '/household')) return { accent: 'slate', title: 'Household', current: '/household', rows: 3 };
  if (is(path, '/guide')) return { accent: 'teal', title: 'How it works', current: '/guide', rows: 4 };
  if (is(path, '/add')) return { accent: 'teal', title: 'Add', current: null, rows: 0, form: true };
  if (is(path, '/scan')) return { accent: 'teal', title: 'Scan a receipt', current: null, rows: 0, form: true };
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
