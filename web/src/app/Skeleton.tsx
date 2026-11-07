import { TABS, TAB_BAR_SPACE, BACK_SPACE, tabLook } from './tabs';
import { cn } from '@/lib/utils';
import { BAR_CLASS, ADD_TILE_CLASS, slotClass, TabFace } from './TabItem';
import { Icon } from './Icon';
import { ACTIVITY_CHIPS, KIND_SHORT, KIND_WORDS, Words, chip, chipOff, chipOn, chipQuiet, chipQuietOn, chipQuietRow, chipRow, countBadge, monthPill, monthStep, rowRule, rulePad, ruleSwipe } from './form-bits';

/* What a screen looks like in the moment between the tap and the data.

   Before this there was nothing: every page is `force-dynamic`, so a tap sat
   on the OLD screen — unchanged, unmarked — until Singapore answered. Two
   hundred milliseconds of a screen that has not acknowledged being touched
   reads as a slow app, and the Doherty threshold is the reason: past about
   400ms attention wanders, and an interface that has not responded AT ALL is
   worse than one that responded with very little.

   So the header arrives instantly, complete and correct — paper, its real
   title where the title is known before the data, the back arrow or the
   tab's chips — and the body is drawn in the shape the screen will have.
   You know where you are before you know what it says, which is the right order.

   Each frame is the finished screen's own structure (Task 29): the same header, the same hero card, the same
   section headings and the same row heights, so swapping in the real page moves nothing at the top of the screen
   (`scripts/frames.check.mjs` measures it: the title, the hero's top and height and the first heading's top agree
   within 4px at 393×852). Text that is not known yet is a `Ghost`: a sample of the same text, set in the same
   type and hidden, with a shimmer over it — so a line is exactly the height the real line will be, and a
   paragraph wraps where the real one will.

   Plain markup, no hooks, so the same frames serve two masters: the route's
   loading.tsx (what the server streams first) and PendingSkeleton (what the
   phone draws the instant a link is tapped, before the server has answered
   at all). `frameFor` is the one place that knows which screen gets which. */

/* ---------- pieces ---------- */

/* The shimmer (v3.1 P4, ux-audit C4.1): one band of light crossing the whole screen at once. `bg-fixed` anchors every
   block's gradient to the viewport, so a wide bar and a narrow one are lit by the same band at the same moment,
   instead of each sweeping on its own clock at a speed set by its own width. Linear over 1.6s; the keyframes are
   globals.css `shim`. Reduced motion: a still block. `data-shim` marks a block for nav-timing ("no shimmer left").
   (iOS Safari draws bg-fixed as bg-scroll: there each column of blocks sweeps together, at the same speed.) */
const SHIM = 'bg-muted bg-[linear-gradient(100deg,transparent_35%,color-mix(in_oklab,var(--card)_70%,transparent)_50%,transparent_65%)] bg-[length:200vw_100%] bg-fixed bg-no-repeat animate-[shim_1.6s_linear_infinite] motion-reduce:animate-none motion-reduce:bg-none';
/* On the plum hero (C4.2): the block is the hero's own ink at a tenth and the band at 18%, never a pale slab. */
const SHIM_HERO = 'bg-hero-foreground/10 bg-[linear-gradient(100deg,transparent_35%,color-mix(in_oklab,var(--hero-foreground)_18%,transparent)_50%,transparent_65%)] bg-[length:200vw_100%] bg-fixed bg-no-repeat animate-[shim_1.6s_linear_infinite] motion-reduce:animate-none motion-reduce:bg-none';

function S({ className = '', hero = false }: { className?: string; hero?: boolean }) {
  return <span aria-hidden data-shim="" className={cn('block flex-none rounded-md', hero ? SHIM_HERO : SHIM, className)} />;
}

/** A line of text not known yet: a sample in the real line's type, hidden, under a shimmer of `w`. */
function Ghost({ as: Tag = 'span', className = '', w = 'w-2/5', fig = false, title = false, hero = false, children }: {
  as?: 'span' | 'p' | 'h2' | 'div'; className?: string; w?: string; children: React.ReactNode;
  /** On the plum hero card: the hero's shimmer. */
  hero?: boolean;
  /** A Figure (NumberFlow) is a quarter of an em taller above and below than its text, for the digits' roll. */
  fig?: boolean;
  /** Where the screen's title will be (frames.check measures it as the title). */
  title?: boolean;
}) {
  return (
    <Tag aria-hidden data-frame={title ? 'title' : undefined} className={`relative block ${fig ? 'py-[.25em]' : ''} ${className}`}>
      <span className="invisible">{children}</span>
      <span data-shim="" className={`${hero ? SHIM_HERO : SHIM} absolute left-0 rounded-md ${fig ? 'inset-y-[.38em]' : 'inset-y-[.18em]'} ${w}`} />
    </Tag>
  );
}

/** The header of every pushed screen and most tabs, drawn: PageHead's own classes, so it is PageHead's height. */
function Head({ back = false, eyebrow, title, sub, subLines = 1, subSample, right, children }: {
  back?: boolean; eyebrow?: string | true; title: string | null;
  /** The line under the title: its words when they are known, null for a ghost of `subLines` lines. */
  sub?: string | null; subLines?: number; subSample?: string;
  right?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 px-[var(--gutter)] pb-4 pt-4">
      {back && (
        <span className="-mb-1 -ml-3 grid size-11 place-items-center rounded-full text-foreground">
          <Icon name="chevron_left" size={22} />
        </span>
      )}
      <div>
        {eyebrow === true ? <Ghost as="p" className="text-footnote" w="w-16">Eyebrow</Ghost>
          : eyebrow ? <p className="text-footnote text-muted-foreground">{eyebrow}</p> : null}
        <div className="flex items-center justify-between gap-3">
          {title
            ? <h1 className="min-w-0 text-large-title font-bold tracking-tight leading-tight [overflow-wrap:anywhere]">{title}</h1>
            : <Ghost as="div" title className="min-w-0 flex-1 text-large-title font-bold tracking-tight leading-tight" w="w-3/5">Title</Ghost>}
          {right}
        </div>
        {sub === undefined ? null
          : sub ? <p className="text-subhead text-muted-foreground">{sub}</p>
          : <Ghost as="p" className="text-subhead" w={subLines > 1 ? 'w-full' : 'w-1/2'}>{subSample ?? SAMPLE[subLines - 1]}</Ghost>}
      </div>
      {children}
    </header>
  );
}

/* Sample lines for a ghost to wrap like the real one: one, two and three lines of text-subhead at phone width. */
const SAMPLE = [
  '4 categories budgeted',
  'Never matched. The first match starts from the balance this account was opened with.',
  'Match an account to its statement: tick off what the statement shows, and find what the books are missing today.',
];

/** A tab's own big header (Home, Activity, Wealth): a small line, the title bold at 32px. */
function TabHead({ title, line, right, below, pb = 'pb-3', lineFirst = false, rightOnTitle = false }: {
  title: React.ReactNode; line: string; right?: React.ReactNode; below?: React.ReactNode; pb?: string; lineFirst?: boolean;
  /** The right-hand piece centred on the title's line (Activity's month pill), not at the foot of the block. */
  rightOnTitle?: boolean;
}) {
  const small = <Ghost as="p" className="text-subhead" w="w-2/5">{line}</Ghost>;
  if (rightOnTitle) return (
    <header className={`flex flex-col gap-3 px-[var(--gutter)] pt-4 ${pb}`}>
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-large-title font-bold leading-tight tracking-tight">{title}</h1>
          {right}
        </div>
        {small}
      </div>
      {below}
    </header>
  );
  return (
    <header className={`flex flex-col gap-3 px-[var(--gutter)] pt-4 ${pb}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {lineFirst && small}
          <h1 className="text-large-title font-bold leading-tight tracking-tight">{title}</h1>
          {!lineFirst && small}
        </div>
        {right}
      </div>
      {below}
    </header>
  );
}

/** A section's small heading: the real words where they are known, a ghost of them where they are not. */
function H2({ children, known = true, className = 'px-0.5' }: { children: string; known?: boolean; className?: string }) {
  const cls = `text-subhead font-semibold text-muted-foreground ${className}`;
  return known ? <h2 className={cls}>{children}</h2> : <Ghost as="h2" className={cls} w="w-24">{children}</Ghost>;
}

/** One list row: a chip, two lines, an amount — the shape of an entry, a tab, an account. Its hairline is the lists'
 *  one rule (form-bits rowRule): from where the words start to the card's right edge, as its card sets it. */
function Row({ h = 'min-h-16 py-2.5', chip = 'size-10 rounded-[12px]', first = 'Groceries at the market', second = 'Card · HDFC Savings',
  third = null, amount = '₹1,250', under = null, chevron = false, last = false, i = 0, pad = '',
  firstCls = 'font-medium', secondCls = 'text-footnote', grip = false }: {
  h?: string; chip?: string | null; first?: string; second?: React.ReactNode; third?: string | null; amount?: string | null;
  /** A small line under the amount ("in the books"). */
  under?: string | null; chevron?: boolean; last?: boolean; i?: number; pad?: string; firstCls?: string; secondCls?: string;
  /** In a swipe row: SwipeRow keeps 28px at the right for its grip, so the words wrap where the real ones do. */
  grip?: boolean;
}) {
  return (
    <div className={`relative flex items-center gap-3 ${h} ${pad} ${grip ? 'mr-7' : ''} ${last ? '' : rowRule}`}>
      {chip && <S className={chip} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Ghost className={`text-body ${firstCls}`} w={['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5'][i % 4]}>{first}</Ghost>
        {second && <Ghost className={secondCls} w={['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4'][i % 4]}>{second}</Ghost>}
        {third && <Ghost className="text-footnote" w="w-1/3">{third}</Ghost>}
      </span>
      {amount && (under
        ? <span className="flex flex-none flex-col items-end gap-0.5">
            <Ghost className="text-body font-semibold" w="w-full">{amount}</Ghost>
            <Ghost className="text-footnote" w="w-full">{under}</Ghost>
          </span>
        : <Ghost className="flex-none text-body font-semibold" w="w-full">{amount}</Ghost>)}
      {chevron && <Icon name="chevron_right" size={20} className="flex-none text-muted-foreground" />}
    </div>
  );
}

/* Regular payments as a household has them (a due's name and its when-line), so a due row wraps where a real one does. */
const DUE_SAMPLE = [
  ['Broadband and cable, the family bundle plan', 'Due Mon 9 Nov · in 2 days · Utilities', '₹1,199'],
  ['Rental income, Pune flat', 'Expected Wed 11 Nov · in 4 days', '+₹22,000'],
  ['School fees, second term', 'Due Sat 14 Nov · in 7 days · Education', '₹45,000'],
];

/* Account names as a household has them, so a reconcile row's name wraps where a real one does. */
const RECONCILE_SAMPLE = [
  ['HDFC Savings · 4471', '₹4,81,932', 'in the books'], ['ICICI Savings · 9930', '₹1,01,285', 'in the books'],
  ['HDFC Regalia · 8802', '₹28,040', 'owed'], ['Cash', '₹15,450', 'in the books'], ['HDFC Recurring Deposit', '₹41,750', 'in the books'],
];

function Rows({ n, ...row }: { n: number } & Parameters<typeof Row>[0]) {
  return <>{Array.from({ length: n }, (_, i) => <Row key={i} {...row} i={i} last={i === n - 1} />)}</>;
}

/** The big figure card a screen leads with (Owed to you, a tab, a person, the books today). */
function FigureCard({ tone = 'card', label = 'Owed to you', size = 'text-large-title', lines = ['Across 3 open tabs'], gap = 'gap-2',
  line = 'text-subhead leading-snug' }: {
  tone?: 'card' | 'hero'; label?: string; size?: string; lines?: string[]; gap?: string; line?: string;
}) {
  return (
    <section aria-hidden className={`flex flex-col ${gap} rounded-[22px] p-4 ${tone === 'hero' ? 'bg-hero text-hero-foreground' : 'bg-card shadow-card'}`}>
      <Ghost hero={tone === 'hero'} className="text-subhead" w="w-1/3">{label}</Ghost>
      <Ghost hero={tone === 'hero'} fig className={`${size} font-bold leading-none tracking-tight`} w="w-1/2">₹12,345</Ghost>
      {lines.map((l, i) => <Ghost hero={tone === 'hero'} key={i} className={line} w="w-3/5">{l}</Ghost>)}
    </section>
  );
}

const CARD = 'overflow-hidden rounded-[20px] bg-card shadow-card';

/* ---------- the frame around every screen ---------- */

/* A frame the server streams (loading.tsx, or a page's own Suspense fallback on a cold load) fades in, after a
   beat: a load quicker than --dur-1 never shows one, and a slower one eases in over --dur-2 rather than cutting in
   (v3.1 P4, ux-audit C4.3). A transition from @starting-style, not tw-animate's enter: that one sets a transform and
   a filter, which would take the frame's fixed footer (a tab's two buttons) out of the viewport while it runs. The
   still bar is outside it, so the bar never fades. The frame a tap draws (PendingSkeleton, `stillBar` off) is the
   tap's own answer and keeps its motion exactly: no delay, no fade of its own. */
const STREAMED = 'transition-opacity duration-(--dur-2) ease-out delay-(--dur-1) starting:opacity-0 motion-reduce:transition-none';

function Frame({ name, current, space, skip, stillBar, children }: {
  name: string; current: string | null; space: 'bar' | 'back' | 'footer'; skip?: string;
  /** Streamed by the server (a still bar of its own, and the fade in); off for the frame a tap draws. */
  stillBar: boolean;
  children: React.ReactNode;
}) {
  const bottom = space === 'bar' ? TAB_BAR_SPACE : space === 'back' ? BACK_SPACE : 'calc(112px + env(safe-area-inset-bottom, 0px))';
  return (
    <>
      <main aria-busy="true" data-frame={skip} className={cn('min-h-dvh bg-background text-foreground', stillBar && STREAMED)} style={{ paddingBottom: bottom }}>
        <span className="sr-only" aria-live="polite">Loading {name}</span>
        {children}
      </main>
      {current && stillBar && <StillTabBar current={current} />}
    </>
  );
}

/* ---------- the screens ---------- */

type Draw = { stillBar: boolean };

function monthNow(style: 'long' | 'short') {
  return new Date().toLocaleDateString('en-IN', style === 'long' ? { month: 'long' } : { month: 'short', year: 'numeric' });
}

/** Left to spend (home/LeftToSpend, and Plan's figures for a month with a budget): the words and the status, the
 *  figure, the pace bar, what is spent of what and the day. */
function LeftToSpendStill({ size }: { size: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-[22px] bg-card shadow-card p-4">
      <div className="flex items-center justify-between gap-3">
        <Ghost className="text-subhead" w="w-full">Left to spend</Ghost>
        <Ghost className="text-footnote font-semibold" w="w-full">On track</Ghost>
      </div>
      <Ghost fig className={`${size} font-bold leading-none tracking-tight`} w="w-1/2">₹12,345</Ghost>
      <div className="py-[3px]"><S className="h-2.5 w-full rounded-full" /></div>
      <div className="flex justify-between gap-3 text-footnote">
        {/* Figures in a line of text-footnote: the line is 20px, not 16. */}
        <Ghost className="h-5" w="w-full">₹1,000 spent of ₹2,000</Ghost>
        <Ghost className="h-5" w="w-full">Day 6 of 30</Ghost>
      </div>
    </div>
  );
}

/** Home: the household and month, Left to spend, the two tiles, the net-worth row, owed to you, today's list. */
function Home({ stillBar }: Draw) {
  return (
    <Frame name="home" current="/" space="bar" stillBar={stillBar}>
      <header className="flex items-end gap-3 px-[var(--gutter)] pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <Ghost as="p" className="text-subhead" w="w-1/3">Household</Ghost>
          <h1 className="text-large-title font-bold leading-tight tracking-tight">{monthNow('long')}</h1>
        </div>
        <S className="size-10 rounded-full" />
      </header>
      <div className="flex flex-col gap-4 px-[var(--gutter)] pb-6 pt-2">
        {/* Left to spend, the card a household with a budget opens on. */}
        <LeftToSpendStill size="text-display" />
        <div className="grid grid-cols-2 gap-3">
          {['To review', 'Due this week'].map((t) => (
            /* 109 and 73, not the page's minimums: a tile and the net-worth row are that tall once their figures are in. */
            <span key={t} className="flex min-h-[109px] flex-col gap-1.5 rounded-[20px] bg-card shadow-card p-4">
              <S className="size-[22px] rounded-md" />
              <Ghost className="text-subhead" w="w-1/2">{t}</Ghost>
              <Ghost className="text-headline font-semibold leading-tight" w="w-3/4">All clear</Ghost>
            </span>
          ))}
        </div>
        <div className="flex min-h-[73px] items-center gap-3 rounded-[20px] bg-hero px-4 py-3.5 text-hero-foreground">
          <span className="grid size-10 flex-none place-items-center"><Icon name="trending_up" size={22} className="text-hero-4" /></span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-subhead text-hero-muted">Household net worth</span>
            <Ghost hero className="text-headline font-semibold leading-tight" w="w-2/5">₹12,34,567</Ghost>
          </span>
          <Icon name="chevron_right" size={22} className="text-hero-muted" />
        </div>
        <div className="flex min-h-14 items-center gap-3 rounded-[20px] bg-card shadow-card px-4">
          <span className="grid size-10 flex-none place-items-center"><Icon name="group" size={22} className="text-primary" /></span>
          <span className="flex-1 text-subhead text-muted-foreground">Owed to you</span>
          <Ghost fig className="text-headline font-semibold" w="w-full">₹5,000</Ghost>
          <Icon name="chevron_right" size={20} className="text-muted-foreground" />
        </div>
        <section aria-hidden className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between px-0.5">
            <H2 known={false} className="py-1">Today</H2>
          </div>
          <div className={`${CARD} px-[var(--pad)] ${ruleSwipe}`}><Rows n={3} grip /></div>
        </section>
      </div>
    </Frame>
  );
}

type View = 'all' | 'review' | 'upcoming' | 'sms';

/** The month pill (MonthPill), drawn: the two arrows and the month, on a card ground, at a chip's height. */
function MonthPillStill() {
  return (
    <div className={`${monthPill} text-muted-foreground`}>
      <span className={monthStep}><Icon name="chevron_left" size={18} /></span>
      <Ghost className="min-w-[68px] text-center text-subhead font-semibold" w="w-full">{monthNow('short')}</Ghost>
      <span className={monthStep}><Icon name="chevron_right" size={18} /></span>
    </div>
  );
}

/** Activity, by chip: the title, the line under it, the month pill on All, the four chips, then the view. */
function Activity({ stillBar, view }: Draw & { view: View }) {
  /* To review and From SMS draw a ghost of their count. The frame cannot know whether anything waits, so the real
     chips keep the badge's room when nothing does (form-bits badgeRoom): either way the chip is the frame's width, and
     the row never reflows when the counts arrive (ux-audit C4.5). */
  const chips = (
    <div aria-hidden className={chipRow}>
      {ACTIVITY_CHIPS.map((c) => (
        <span key={c.key} className={`${chip} ${c.key === view ? chipOn : chipOff}`}>
          <Words label={c.label} short={c.short} wide={c.wide} />
          {(c.key === 'review' || c.key === 'sms') && <span className={`${countBadge} ${c.key === view ? 'bg-primary-foreground/30' : 'bg-muted'}`} />}
        </span>
      ))}
    </div>
  );
  return (
    <Frame name="activity" current="/entries" space="bar" stillBar={stillBar}>
      <TabHead title="Activity" line="10 entries · ₹11,609 spent" right={view === 'all' ? <MonthPillStill /> : undefined} rightOnTitle below={chips} />
      <div className="pb-6">
        {view === 'all' && (
          <div className="pt-3">
            <div className="flex flex-col gap-1.5 px-[var(--gutter)] pb-3">
              <span className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground in-data-[platform=android]:min-h-12">
                <Icon name="search" size={18} />
                <span className="py-2 text-muted-foreground">Search this month</span>
              </span>
              <div className={`pt-1.5 ${chipQuietRow}`}>
                {Object.entries(KIND_WORDS).map(([k, label], i) => (
                  <span key={k} className={cn(chip, i === 0 ? chipQuietOn : chipQuiet)}><Words label={label} short={KIND_SHORT[k]} /></span>
                ))}
              </div>
            </div>
            {[2, 2].map((n, d) => (
              <section key={d} aria-hidden className="mb-4 flex flex-col gap-1.5">
                <H2 known={false} className="mx-[var(--gutter)] px-0.5">Today</H2>
                <div className={`mx-[var(--gutter)] ${CARD} px-[var(--pad)] ${ruleSwipe}`}><Rows n={n} grip /></div>
              </section>
            ))}
          </div>
        )}
        {view !== 'all' && (
          <div className="flex flex-col gap-5">
            {(view === 'sms' ? [] : [2, 3]).map((n, s) => (
              <section key={s} aria-hidden className="flex flex-col gap-1.5">
                <div className="mx-[var(--gutter)] flex min-h-6 items-center px-0.5">
                  <H2 known={false} className="">Card bills</H2>
                </div>
                {/* A bill's and a due's lines are samples of the real ones (the words a row is built from), so they wrap
                    where the real ones do at every width, rather than fixed heights per width. */}
                <div className={`mx-[var(--gutter)] ${CARD} px-[var(--pad)] ${view === 'upcoming' && s === 0 ? rulePad : ruleSwipe}`}>
                  {view === 'upcoming'
                    ? DUE_SAMPLE.slice(0, n).map(([first, second, amount], i) => (
                      <Row key={i} i={i} last={i === n - 1} grip h="min-h-[72px] py-2.5" first={first} second={second} amount={amount} third={s === 0 ? null : 'Next in 12 days'} />))
                    : <Rows n={n} grip h="min-h-[72px] py-2.5" first="HDFC Regalia · 8802" second={<><span className="inline-block w-[18px]" />Due in 5 days · 6 purchases</>} />}
                </div>
              </section>
            ))}
            {view === 'sms' && (
              <div className={`mx-[var(--gutter)] flex flex-col items-center gap-3 rounded-[20px] bg-card shadow-card px-6 py-8`}>
                <S className="size-8 rounded-full" />
                <Ghost as="p" className="max-w-[32ch] text-center text-subhead leading-relaxed" w="w-full">
                  No bank messages waiting. Forward your bank’s messages from your phone and each one waits here until you add it or dismiss it.
                </Ghost>
                <S className="h-11 w-40 rounded-full" />
              </div>
            )}
          </div>
        )}
      </div>
    </Frame>
  );
}

/** An entry opened to edit: the kind as the title, the line under it, then the one form card. */
function Entry({ stillBar }: Draw) {
  return (
    <Frame name="the entry" current="/entry" space="bar" stillBar={stillBar} skip="skip-label">
      <Head back eyebrow="Activity" title={null} sub={null} />
      <div className="pt-[18px]">
        <div className="mx-[var(--gutter)] mb-4 flex flex-col gap-3.5 rounded-[20px] bg-card shadow-card p-[var(--pad)]">
          {[88, 122, 80, 327, 74, 74].map((h, i) => (
            <span key={i} className="flex flex-col gap-1.5" style={{ height: h }}>
              <Ghost className="text-subhead font-medium" w="w-1/4">Amount</Ghost>
              <S className="w-full flex-1 rounded-xl" />
            </span>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Add, opened as a page: close, the three kinds, the amount, the categories, the details card, Save. */
function Add({ stillBar }: Draw) {
  return <AddFrame streamed={stillBar} />;
}

/** Add Entry's frame: the full page's, or (`sheet`) inside the Add drawer while a phone with no kept pickers waits
 *  for the route (InstantAdd). */
export function AddFrame({ sheet = false, streamed = false }: { sheet?: boolean; streamed?: boolean }) {
  return (
    <main aria-busy="true" data-frame="skip-label" className={cn('flex flex-col bg-background text-foreground', sheet ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-dvh', streamed && STREAMED)}>
      <span className="sr-only" aria-live="polite">Loading a new entry</span>
      <header className="flex flex-none flex-col gap-1 px-[var(--gutter)] pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="-ml-2.5 flex size-11 items-center justify-center in-data-[platform=android]:size-12"><Icon name="close" size={24} /></span>
          <div className="flex rounded-xl bg-muted p-[3px]">
            {['Expense', 'Income', 'Move'].map((k, i) => (
              <span key={k} className={`grid min-h-11 place-items-center rounded-[10px] px-3 text-body ${i === 0 ? 'bg-raised font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground'}`}>{k}</span>
            ))}
          </div>
          <span className="-mr-2.5 size-11 in-data-[platform=android]:size-12" />
        </div>
        {/* The amount: the currency is the household's, not known to a frame, so the whole line is a ghost. */}
        <div className="flex min-w-0 items-baseline justify-center gap-1.5 py-2">
          <Ghost className="text-amount font-bold leading-tight tracking-tight" w="w-full">₹0</Ghost>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pb-4 pt-2">
        <section aria-hidden className="flex flex-col gap-2">
          <span className="text-footnote font-semibold text-muted-foreground">Category · your most used</span>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-card">
                <S className="size-6 rounded-full" />
                <S className="h-2.5 w-3/5" />
              </span>
            ))}
          </div>
        </section>
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {['Paid with', 'When', null].map((t) => (
            <span key={t ?? 'more'} className="flex min-h-14 items-center gap-3 px-3.5 py-2 text-muted-foreground">
              <S className="size-[22px] rounded-md" />
              {t ? (
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-footnote">{t}</span>
                  <Ghost className="text-body font-medium" w="w-1/2">GPay · HDFC Savings</Ghost>
                </span>
              ) : <span className="flex-1 text-body">Note, bill, tab, shared…</span>}
              <Icon name="expand_more" size={20} />
            </span>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex-none border-t border-border bg-background px-[var(--gutter)] pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
        <span className="flex h-14 w-full items-center justify-center rounded-2xl bg-muted text-headline font-semibold text-muted-foreground">Save</span>
      </div>
    </main>
  );
}

/** Loans: the title and New tab, Owed to you, then the open tabs. */
function Loans({ stillBar }: Draw) {
  return (
    <Frame name="loans" current="/people" space="bar" stillBar={stillBar}>
      <Head title="Loans" right={<S className="h-9 w-[108px] rounded-full" />} />
      <div className="flex flex-col gap-5 px-[var(--gutter)] pb-6">
        <FigureCard size="text-display" lines={['Across 1 open tab · ₹1,000 came back in November']} />
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>Open tabs</H2>
          <div className={`${CARD} px-[var(--pad)] ${ruleSwipe} [--rule-x:48px]`}><Rows n={4} grip chip="size-9 rounded-[11px]" second="2 costs · last cost 3 Nov" /></div>
        </section>
      </div>
    </Frame>
  );
}

/** A person: their name, what is between you, the two actions, then what is owed and lent. */
function Person({ stillBar }: Draw) {
  return (
    <Frame name="the person" current={null} space="back" stillBar={stillBar}>
      <Head back eyebrow="Loans" title={null} />
      <div className="flex flex-col gap-5 pb-6">
        <div className="mx-[var(--gutter)]"><FigureCard label="Owes you" lines={['₹2,000 lent · ₹500 for shared costs']} /></div>
        {/* PersonActions' two buttons: 160px each at least, so below 375px they stack. */}
        <div className="mx-[var(--gutter)] flex flex-wrap gap-2">
          {['Lend money', 'Got money back'].map((t) => (
            <span key={t} data-shim="" className={cn('flex h-[54px] flex-1 basis-40 items-center justify-center gap-2 rounded-2xl border border-transparent px-4 text-body font-semibold', SHIM)}>
              <span className="invisible size-[18px] flex-none" /><span className="invisible whitespace-nowrap">{t}</span>
            </span>
          ))}
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <H2 known={false}>Shared costs</H2>
          <div className={`${CARD} [--rule-x:14px]`}><Rows n={3} chip={null} pad="px-3.5" /></div>
        </section>
      </div>
    </Frame>
  );
}

/** A tab: its name and menu, what is still to come back, the people on it, the costs by month, two buttons. */
function Tab({ stillBar }: Draw) {
  return (
    <Frame name="the tab" current={null} space="footer" stillBar={stillBar}>
      <Head back eyebrow="Tab" title={null} right={<span className="-mr-2.5 grid size-11 flex-none place-items-center in-data-[platform=android]:size-12"><Icon name="more_horiz" size={24} /></span>} />
      <div className="flex flex-col gap-5 pb-6">
        <div className="flex flex-col gap-3 px-[var(--gutter)]">
          <FigureCard label="Still to come back" lines={['₹4,000 put on across 3 costs · ₹500 back']} />
          <div aria-hidden className={chipRow}>
            {['w-[104px]', 'w-[92px]', 'w-[116px]', 'w-[84px]'].map((w) => <S key={w} className={`h-8 rounded-full ${w}`} />)}
          </div>
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <H2 known={false}>November</H2>
          <div className={`${CARD} px-[var(--pad)] ${ruleSwipe} [--rule-x:48px]`}><Rows n={2} grip h="min-h-[72px] py-2.5" chip="size-9 rounded-[11px]" /></div>
        </section>
      </div>
      <div aria-hidden className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-background px-[var(--gutter)] pb-[calc(14px+env(safe-area-inset-bottom,0px))] pt-3">
        <S className="h-[54px] flex-1 rounded-2xl" />
        <S className="h-[54px] flex-[1.3] rounded-2xl" />
      </div>
    </Frame>
  );
}

/** Wealth: the household and the title, the owner chips, the dark net-worth card, then the lists. */
function Wealth({ stillBar }: Draw) {
  return (
    <Frame name="wealth" current="/worth" space="bar" stillBar={stillBar}>
      <TabHead title="Wealth" line="Household" lineFirst right={
        <span className="grid size-11 flex-none place-items-center rounded-full bg-card text-foreground in-data-[platform=android]:size-12"><Icon name="add" size={24} /></span>} />
      <div className="flex flex-col gap-4">
        <div aria-hidden className={`${chipRow} px-[var(--gutter)]`}>
          {['Household', 'Ammar', 'Sara', 'Joint'].map((n, i) => (
            <span key={n} className={`${chip} ${i === 0 ? chipOn : chipOff}`}>
              <Ghost w="w-full">{n}</Ghost>
            </span>
          ))}
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-3 rounded-[22px] bg-hero p-4 text-hero-foreground">
          <span className="text-subhead text-hero-muted">Household net worth</span>
          <Ghost hero fig className="text-display font-bold leading-none tracking-tight" w="w-1/2">₹12,34,567</Ghost>
          <S hero className="h-2.5 w-full rounded-full" />
          {/* The legend's words are known; only the figures are not. The same grid as WealthView's, so a word that wraps
              at 360 wraps here too. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-footnote">
            {[['bg-hero-1', 'Bank & cash'], ['bg-hero-2', 'Pots'], ['bg-hero-3', 'Gold & silver'], ['bg-hero-4', 'Owed to you']].map(([sw, word]) => (
              <span key={word} className="flex min-w-0 items-center gap-1.5">
                <span className={`size-2.5 flex-none rounded-[3px] ${sw}`} />
                <span className="text-hero-muted">{word}</span>
                <Ghost hero className="ml-auto h-5 font-semibold" w="w-full">₹6,40,417</Ghost>
              </span>
            ))}
          </div>
          <p className="flex items-center justify-between border-t border-hero-foreground/15 pt-2 text-footnote">
            <span className="text-hero-muted">Less cards and money you owe</span>
            <Ghost hero className="h-5 font-semibold" w="w-full">₹28,040</Ghost>
          </p>
        </section>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 px-0.5"><H2 known={false} className="">Pots in other currencies</H2></div>
          <div className={`${CARD} [--rule-x:66px]`}><Rows n={3} h="min-h-16 py-2.5" pad="px-3.5" chip="size-10 rounded-[12px]" /></div>
        </section>
      </div>
    </Frame>
  );
}

/** One holding: its kind and name, what it is worth on the dark card, the rate, two buttons, its history. */
function Holding({ stillBar }: Draw) {
  return (
    <Frame name="the holding" current={null} space="back" stillBar={stillBar}>
      <header className="flex flex-col gap-2 px-[var(--gutter)] pb-3 pt-4">
        <span className="-mb-1 -ml-3 grid size-11 place-items-center rounded-full text-foreground"><Icon name="chevron_left" size={22} /></span>
        <Ghost as="p" className="text-body" w="w-2/5">Pots in other currencies</Ghost>
        <Ghost as="div" title className="text-title-2 font-bold leading-tight tracking-tight" w="w-3/5">Holding</Ghost>
      </header>
      <div className="flex flex-col gap-4 px-[var(--gutter)]">
        <FigureCard tone="hero" label="Joint · Dirhams" lines={['1,000 AED on 6 Nov']} line="text-body" />
        <div className="flex min-h-14 items-center gap-3 rounded-[20px] bg-card shadow-card px-3.5 py-2.5">
          <S className="size-[22px] rounded-md" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Ghost className="text-body" w="w-1/2">1 AED = ₹22.70</Ghost>
            <Ghost className="text-footnote" w="w-1/3">Rate from today</Ghost>
          </span>
        </div>
        <div className="flex gap-2">
          <S className="h-12 flex-1 rounded-xl" />
          <S className="h-12 flex-1 rounded-xl" />
        </div>
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>History</H2>
          <div className={`${CARD} [--rule-x:14px]`}><Rows n={2} chip={null} amount="AED 1,000" h="py-3" pad="px-3.5" second={null} /></div>
        </section>
      </div>
    </Frame>
  );
}

/** Accounts: the title and the household, the net-worth card, then the accounts by section. */
function Accounts({ stillBar }: Draw) {
  return (
    <Frame name="accounts" current="/accounts" space="bar" stillBar={stillBar}>
      <Head back title="Accounts" sub={null} subSample="Household" />
      <div className="flex flex-col gap-6 px-[var(--gutter)] pb-8">
        <div className="flex flex-col gap-3 rounded-[22px] bg-card shadow-card p-4">
          <span className="flex items-center justify-between">
            <span className="text-subhead text-muted-foreground">Net worth</span>
            <Icon name="chevron_right" size={20} className="text-muted-foreground" />
          </span>
          <Ghost fig className="text-large-title font-bold leading-none tracking-tight" w="w-1/2">₹12,34,567</Ghost>
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            {['Held', 'Owed to you', 'You owe'].map((t) => (
              <span key={t} className="flex flex-col gap-0.5">
                <span className="text-footnote text-muted-foreground">{t}</span>
                <Ghost className="text-body font-semibold" w="w-4/5">₹1,23,456</Ghost>
              </span>
            ))}
          </div>
        </div>
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>Bank and cash</H2>
          <div className={`${CARD} [--rule-x:calc(var(--pad)+50px)]`}><Rows n={3} chip="size-[38px] rounded-[11px]" h="min-h-[72px] py-3" pad="px-[var(--pad)]" second="UPI · Debit card" /></div>
        </section>
      </div>
    </Frame>
  );
}

/** Reconcile, the list: which account to match. */
function ReconcileList({ stillBar }: Draw) {
  return (
    <Frame name="reconcile" current="/accounts" space="bar" stillBar={stillBar}>
      <Head back title="Reconcile"
        sub="Match an account to its statement: tick off what the statement shows, and find what the books are missing." />
      <section aria-hidden className="flex flex-col gap-1.5 px-[var(--gutter)] pb-8">
        <H2>Which account</H2>
        <div className={`${CARD} [--rule-x:calc(var(--pad)+50px)]`}>
          {RECONCILE_SAMPLE.map(([name, amount, under], i) => (
            <Row key={name} i={i} last={i === RECONCILE_SAMPLE.length - 1} chip="size-[38px] rounded-[11px]" h="min-h-[72px] py-3" pad="px-[var(--pad)]"
              first={name} firstCls="font-semibold leading-snug" second={<><span className="inline-block w-[18px]" />Never matched · 12 entries to check</>} secondCls="text-subhead leading-snug"
              amount={amount} under={under} chevron />
          ))}
        </div>
      </section>
    </Frame>
  );
}

/** Reconcile one account: its name, when it was last matched, the books today, then the statement form. */
function Reconcile({ stillBar }: Draw) {
  return (
    <Frame name="the reconciliation" current={null} space="back" stillBar={stillBar} skip="skip-label">
      <Head back eyebrow="Reconcile" title={null} sub={null} subLines={2} />
      <div className="flex flex-col gap-5 pb-8">
        <div className="mx-[var(--gutter)]"><FigureCard label="In the books today" size="text-large-title" lines={[]} gap="gap-1.5" /></div>
        <div className="mx-[var(--gutter)] flex h-[224px] flex-col gap-3.5 rounded-[20px] bg-card shadow-card p-[var(--pad)]">
          <Ghost className="text-subhead font-medium" w="w-1/3">Statement</Ghost>
          <S className="h-12 w-full rounded-xl" />
          <S className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </Frame>
  );
}

/** Plan: the title, the month pill, the month's figures, then the budget lines. */
function Plan({ stillBar }: Draw) {
  return (
    <Frame name="plan" current="/budget" space="bar" stillBar={stillBar}>
      <Head back title="Plan" sub={null} right={<MonthPillStill />} />
      <div className="flex flex-col gap-5 pb-6">
        <div className="flex flex-col gap-4 px-[var(--gutter)]">
          <LeftToSpendStill size="text-large-title" />
          <section aria-hidden className="flex flex-col gap-1.5">
            <H2>By category</H2>
            <div className={`${CARD} [--rule-x:calc(var(--pad)+48px)]`}><Rows n={4} chip="size-9 rounded-[11px]" pad="px-[var(--pad)]" /></div>
          </section>
        </div>
      </div>
    </Frame>
  );
}

/** Categories: the line about order, then the list in use. */
function Categories({ stillBar }: Draw) {
  return (
    <Frame name="categories" current="/categories" space="bar" stillBar={stillBar}>
      <Head back eyebrow="Plan" title="Categories" sub={null} subLines={2} />
      <div className="flex flex-col gap-4 pb-8">
        <section aria-hidden className="flex flex-col gap-1.5 px-[var(--gutter)]">
          <H2>In use</H2>
          <div className={`${CARD} [--rule-x:calc(var(--pad)+50px)]`}><Rows n={10} chip="size-[38px] rounded-[11px]" pad="px-[var(--pad)]" second={null} amount={null} h="min-h-[72px] py-2" /></div>
        </section>
      </div>
    </Frame>
  );
}

/** Household: its name, then You, the members, and the rest in sections. */
function Household({ stillBar }: Draw) {
  return (
    <Frame name="the household" current="/household" space="bar" stillBar={stillBar}>
      <Head back title={null} sub={null} subSample="Household and settings · 2 members" />
      <div className="flex flex-col gap-6 px-[var(--gutter)] pb-8">
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>Members</H2>
          <div className={`${CARD} [&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:top-0 [&>*+*]:before:right-0 [&>*+*]:before:left-[calc(var(--pad)+52px)] [&>*+*]:before:h-px [&>*+*]:before:bg-border [&>*+*]:before:content-['']`}>
            {[MEMBER_H, MEMBER_H].map((h, i) => (
              <div key={i} className="flex flex-col justify-center" style={{ height: h }}>
                <Row i={i} chip="size-10 rounded-full" h="" pad="px-[var(--pad)]" amount={null}
                  first={i ? 'Sara' : 'Ammar · you'} second="ammar@example.com" last />
              </div>
            ))}
          </div>
        </section>
      </div>
    </Frame>
  );
}

/* A member's row (household/MemberRow) as it measures at 393px: a name, the address, and, for the owner, whether
   Google is linked. */
const MEMBER_H = 112;

/** SMS capture: how it works, then the phones, adding one, and the set-up guides. */
function Capture({ stillBar }: Draw) {
  return (
    <Frame name="SMS capture" current="/household" space="bar" stillBar={stillBar}>
      <Head back title="SMS capture" sub="Bank messages become drafts to review" />
      <div className="flex flex-col gap-6 px-[var(--gutter)]">
        {/* The page's two sentences as the ghosts' samples, so they wrap where the real ones do. */}
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
          {['Each message is a draft under To review. Nothing is recorded until you save it.',
            'One-time passwords are never stored. The text of a message is deleted once it is handled, or after 30 days.'].map((t) => (
            <span key={t} className="flex items-start gap-2.5">
              <S className="mt-0.5 size-[18px] rounded-full" />
              <Ghost as="span" className="flex-1 text-body leading-relaxed" w="w-full">{t}</Ghost>
            </span>
          ))}
        </div>
        <section aria-hidden className="flex flex-col gap-2">
          <div className="flex min-h-6 items-baseline justify-between px-1">
            <h2 className="text-footnote font-semibold uppercase tracking-wider text-muted-foreground">Phones in this household</h2>
          </div>
          <S className="h-[57px] w-full rounded-2xl" />
        </section>
      </div>
    </Frame>
  );
}

/** Scan: the title and what it does, then the card with the camera. */
function Scan({ stillBar }: Draw) {
  return (
    <Frame name="scan" current="/scan" space="bar" stillBar={stillBar} skip="skip-label">
      <Head back title="Scan a receipt"
        sub="It reads the total, the date and the shop. You check them and save; nothing is recorded on your behalf." />
      <div className="flex flex-col gap-4 px-[var(--gutter)] pb-8">
        <div className="flex flex-col gap-3.5 rounded-[20px] bg-card shadow-card p-[var(--pad)]">
          <span className="flex items-start gap-2">
            <S className="mt-px size-[18px] rounded-full" />
            <Ghost as="span" className="flex-1 text-subhead leading-normal" w="w-full">Scanning needs a Google AI key, which is free and takes a minute to get. An owner adds it once under Household.</Ghost>
          </span>
          <S className="h-[52px] w-full rounded-xl" />
        </div>
      </div>
    </Frame>
  );
}

/** How it works: the one list of things worth knowing. */
function Guide({ stillBar }: Draw) {
  return (
    <Frame name="how it works" current="/guide" space="bar" stillBar={stillBar} skip="skip-label">
      <Head back title="How it works" sub={null} />
      <div className="px-[var(--gutter)] pb-8">
        <div className={`${CARD} [--rule-x:calc(var(--pad)+40px)]`}><Rows n={16} chip="size-7 rounded-full" second={null} amount={null} h="min-h-14 py-3" pad="px-[var(--pad)]" /></div>
      </div>
    </Frame>
  );
}

/** A bank message: who sent it, its status, then the message and what was read from it. */
function Message({ stillBar }: Draw) {
  return (
    <Frame name="the message" current="/entries" space="bar" stillBar={stillBar}>
      <Head back title="Bank message" sub={null} />
      <div className="flex flex-col gap-5 px-[var(--gutter)]">
        <S className="h-11 w-36 rounded-full" />
        <section aria-hidden className="flex flex-col gap-2">
          <div className="flex min-h-6 items-baseline justify-between px-1">
            <h2 className="text-footnote font-semibold uppercase tracking-wider text-muted-foreground">The message</h2>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <Ghost as="p" className="text-body leading-relaxed" w="w-full">Rs 1,250.00 spent on your HDFC Bank card ending 8802 at the market on 06-11-26. Not you? Call the bank.</Ghost>
          </div>
        </section>
      </div>
    </Frame>
  );
}

/* ---------- which screen gets which ---------- */

const FRAMES = {
  home: Home, entry: Entry, add: Add, loans: Loans, person: Person, tab: Tab, wealth: Wealth, holding: Holding,
  accounts: Accounts, 'reconcile-list': ReconcileList, reconcile: Reconcile, plan: Plan, categories: Categories,
  household: Household, capture: Capture, scan: Scan, guide: Guide, message: Message,
} as const;
export type FrameKey = keyof typeof FRAMES | `activity:${View}`;

const ID = '[^/]+';
const is = (path: string, pattern: string) => new RegExp(`^${pattern}/?$`).test(path);

/** Which frame an address gets (the path, and for Activity its `?f=` chip), or null for a screen that draws
 *  none (sign-in and friends). */
export function frameFor(href: string): FrameKey | null {
  const [path, query = ''] = href.split('?');
  if (path === '/') return 'home';
  // Activity, whichever chip. /inbox and /schedules redirect to its review and upcoming chips.
  if (is(path, '/entries') || is(path, '/inbox') || is(path, '/schedules')) {
    const f = new URLSearchParams(query).get('f');
    const view: View = path === '/inbox' ? (new URLSearchParams(query).has('dismissed') ? 'sms' : 'review')
      : path === '/schedules' ? 'upcoming'
      : f === 'review' || f === 'upcoming' || f === 'sms' ? f : 'all';
    return `activity:${view}`;
  }
  if (is(path, `/entries/${ID}`)) return 'entry';
  if (is(path, `/inbox/sms/${ID}`)) return 'message';
  // Plan: the month's figures, then the budget lines. (/trends redirects to Plan's #trends.)
  if (is(path, '/budget') || is(path, '/trends')) return 'plan';
  if (is(path, '/categories')) return 'categories';
  if (is(path, '/accounts')) return 'accounts';
  if (is(path, '/accounts/reconcile')) return 'reconcile-list';
  if (is(path, `/accounts/${ID}/reconcile`)) return 'reconcile';
  if (is(path, '/worth')) return 'wealth';
  if (is(path, `/worth/${ID}`)) return 'holding';
  if (is(path, '/people')) return 'loans';
  if (is(path, `/people/${ID}`)) return 'person';
  if (is(path, `/tab/${ID}`)) return 'tab';
  if (is(path, '/household')) return 'household';
  if (is(path, '/household/capture')) return 'capture';
  if (is(path, '/guide')) return 'guide';
  if (is(path, '/add')) return 'add';
  if (is(path, '/scan')) return 'scan';
  return null;
}

/** The frame for an address, drawn. */
export function SkeletonFor({ path, stillBar = true }: { path: string; stillBar?: boolean }) {
  const f = frameFor(path);
  if (!f) return null;
  if (f.startsWith('activity:')) return <Activity view={f.slice(9) as View} stillBar={stillBar} />;
  const Draw = FRAMES[f as keyof typeof FRAMES];
  return <Draw stillBar={stillBar} />;
}

/* The tab bar, drawn but not wired. It is on screen for the two hundred
   milliseconds before the real one arrives with the page, and it shares the
   real one's view-transition name so the swap is invisible.

   Why not the real one: TabBar is a client component, and a client component
   inside a loading boundary makes Next write its chunk into the page as a
   plain <script> that never gets the CSP nonce — which the policy then
   refuses, correctly, and logs. A bar made of nothing but markup has no
   chunk to write. The drawing (BAR_CLASS, slotClass, TabFace) is TabBar's own, from TabItem, and the lit tab is
   worked out by the same tabLook, so the two are one picture on iOS and Android alike. */
export function StillTabBar({ current }: { current: string }) {
  return (
    <nav aria-hidden className={BAR_CLASS}>
      {TABS.map((t) => {
        if (t.add) {
          return (
            <span key={t.href} className="flex h-full flex-1 items-center justify-center">
              <span className={ADD_TILE_CLASS}><Icon name={t.icon} size={28} /></span>
            </span>
          );
        }
        const { on, here } = tabLook(t, current);
        return (
          <span key={t.href} className={slotClass(on)}>
            <TabFace t={t} on={on} here={here} />
          </span>
        );
      })}
    </nav>
  );
}
