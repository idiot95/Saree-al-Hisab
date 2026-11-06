import { TABS, TAB_BAR_SPACE, BACK_SPACE, tabLook } from './tabs';
import { BAR_CLASS, ADD_TILE_CLASS, slotClass, TabFace } from './TabItem';
import { Icon } from './Icon';

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

function S({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`shim block flex-none rounded-md ${className}`} />;
}

/** A line of text not known yet: a sample in the real line's type, hidden, under a shimmer of `w`. */
function Ghost({ as: Tag = 'span', className = '', w = 'w-2/5', fig = false, title = false, children }: {
  as?: 'span' | 'p' | 'h2' | 'div'; className?: string; w?: string; children: React.ReactNode;
  /** A Figure (NumberFlow) is a quarter of an em taller above and below than its text, for the digits' roll. */
  fig?: boolean;
  /** Where the screen's title will be (frames.check measures it as the title). */
  title?: boolean;
}) {
  return (
    <Tag aria-hidden data-frame={title ? 'title' : undefined} className={`relative block ${fig ? 'py-[.25em]' : ''} ${className}`}>
      <span className="invisible">{children}</span>
      <span className={`shim absolute left-0 rounded-md ${fig ? 'inset-y-[.38em]' : 'inset-y-[.18em]'} ${w}`} />
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
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow === true ? <Ghost as="p" className="text-xs" w="w-16">Eyebrow</Ghost>
            : eyebrow ? <p className="text-xs text-muted-foreground">{eyebrow}</p> : null}
          {title
            ? <h1 className="text-[30px] font-bold tracking-tight leading-tight [overflow-wrap:anywhere]">{title}</h1>
            : <Ghost as="div" title className="text-[30px] font-bold tracking-tight leading-tight" w="w-3/5">Title</Ghost>}
          {sub === undefined ? null
            : sub ? <p className="text-sm text-muted-foreground">{sub}</p>
            : <Ghost as="p" className="text-sm" w={subLines > 1 ? 'w-full' : 'w-1/2'}>{subSample ?? SAMPLE[subLines - 1]}</Ghost>}
        </div>
        {right}
      </div>
      {children}
    </header>
  );
}

/* Sample lines for a ghost to wrap like the real one: one, two and three lines of text-sm at phone width. */
const SAMPLE = [
  '4 categories budgeted',
  'Never matched. The first match starts from the balance this account was opened with.',
  'Match an account to its statement: tick off what the statement shows, and find what the books are missing today.',
];

/** A tab's own big header (Home, Activity, Wealth): a small line, the title bold at 32px. */
function TabHead({ title, line, right, below, pb = 'pb-3', lineFirst = false }: {
  title: React.ReactNode; line: string; right?: React.ReactNode; below?: React.ReactNode; pb?: string; lineFirst?: boolean;
}) {
  const small = <Ghost as="p" className={lineFirst ? 'text-[13px]' : 'text-sm'} w="w-2/5">{line}</Ghost>;
  return (
    <header className={`flex flex-col gap-3 px-[var(--gutter)] pt-4 ${pb}`}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {lineFirst && small}
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
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
  const cls = `text-[13px] font-semibold text-muted-foreground ${className}`;
  return known ? <h2 className={cls}>{children}</h2> : <Ghost as="h2" className={cls} w="w-24">{children}</Ghost>;
}

/** One list row: a chip, two lines, an amount — the shape of an entry, a tab, an account. */
function Row({ h = 'min-h-16 py-2.5', chip = 'size-10 rounded-xl', first = 'Groceries at the market', second = 'Card · HDFC Savings',
  amount = '₹1,250', last = false, i = 0, pad = '' }: {
  h?: string; chip?: string | null; first?: string; second?: string | null; amount?: string | null; last?: boolean; i?: number; pad?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${h} ${pad} ${last ? '' : 'border-b border-border'}`}>
      {chip && <S className={chip} />}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Ghost className="text-[15px] font-medium" w={['w-3/5', 'w-1/2', 'w-2/3', 'w-2/5'][i % 4]}>{first}</Ghost>
        {second && <Ghost className="text-xs" w={['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4'][i % 4]}>{second}</Ghost>}
      </span>
      {amount && <Ghost className="flex-none text-[15px] font-semibold" w="w-full">{amount}</Ghost>}
    </div>
  );
}

function Rows({ n, ...row }: { n: number } & Parameters<typeof Row>[0]) {
  return <>{Array.from({ length: n }, (_, i) => <Row key={i} {...row} i={i} last={i === n - 1} />)}</>;
}

/** The big figure card a screen leads with (Owed to you, a tab, a person, the books today). */
function FigureCard({ tone = 'card', label = 'Owed to you', size = 'text-[38px]', lines = ['Across 3 open tabs'], gap = 'gap-2',
  line = 'text-[13px] leading-snug' }: {
  tone?: 'card' | 'hero'; label?: string; size?: string; lines?: string[]; gap?: string; line?: string;
}) {
  return (
    <section aria-hidden className={`flex flex-col ${gap} rounded-[22px] p-[18px] ${tone === 'hero' ? 'bg-hero text-hero-foreground' : 'bg-card'}`}>
      <Ghost className="text-[13px]" w="w-1/3">{label}</Ghost>
      <Ghost fig className={`${size} font-bold leading-none tracking-tight`} w="w-1/2">₹12,345</Ghost>
      {lines.map((l, i) => <Ghost key={i} className={line} w="w-3/5">{l}</Ghost>)}
    </section>
  );
}

const CARD = 'overflow-hidden rounded-[18px] bg-card';

/* ---------- the frame around every screen ---------- */

function Frame({ name, current, space, skip, stillBar, children }: {
  name: string; current: string | null; space: 'bar' | 'back' | 'footer'; skip?: string; stillBar: boolean;
  children: React.ReactNode;
}) {
  const bottom = space === 'bar' ? TAB_BAR_SPACE : space === 'back' ? BACK_SPACE : 'calc(112px + env(safe-area-inset-bottom, 0px))';
  return (
    <main aria-busy="true" data-frame={skip} className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: bottom }}>
      <span className="sr-only" aria-live="polite">Loading {name}</span>
      {children}
      {current && stillBar && <StillTabBar current={current} />}
    </main>
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
    <div className="flex flex-col gap-3 rounded-[22px] bg-card p-[18px]">
      <div className="flex items-center justify-between gap-3">
        <Ghost className="text-[13px]" w="w-full">Left to spend</Ghost>
        <Ghost className="text-xs font-semibold" w="w-full">On track</Ghost>
      </div>
      <Ghost fig className={`${size} font-bold leading-none tracking-tight`} w="w-1/2">₹12,345</Ghost>
      <div className="py-[3px]"><S className="h-2.5 w-full rounded-full" /></div>
      <div className="flex justify-between gap-3 text-xs">
        {/* Figures in a line of text-xs: the line is 20px, not 16. */}
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
          <Ghost as="p" className="text-[13px]" w="w-1/3">Household</Ghost>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight">{monthNow('long')}</h1>
        </div>
        <S className="size-11 rounded-full in-data-[platform=android]:size-12" />
      </header>
      <div className="flex flex-col gap-4 px-[var(--gutter)] pb-6 pt-2">
        {/* Left to spend, the card a household with a budget opens on. */}
        <LeftToSpendStill size="text-[40px]" />
        <div className="grid grid-cols-2 gap-3">
          {['To review', 'Due this week'].map((t) => (
            /* 104 and 72, not the page's minimums: a tile and the net-worth row are that tall once their figures are in. */
            <span key={t} className="flex min-h-[104px] flex-col gap-1.5 rounded-[18px] bg-card p-3.5">
              <S className="size-[22px] rounded-md" />
              <Ghost className="text-xs" w="w-1/2">{t}</Ghost>
              <Ghost className="text-lg font-semibold leading-tight" w="w-3/4">All clear</Ghost>
            </span>
          ))}
        </div>
        <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] bg-hero px-4 py-3.5 text-hero-foreground">
          <Icon name="trending_up" size={22} className="text-hero-4" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs text-hero-muted">Household net worth</span>
            <Ghost className="text-lg font-semibold leading-tight" w="w-2/5">₹12,34,567</Ghost>
          </span>
          <Icon name="chevron_right" size={22} className="text-hero-muted" />
        </div>
        <div className="flex min-h-14 items-center gap-3 rounded-[18px] bg-card px-4">
          <Icon name="group" size={20} className="text-primary" />
          <span className="flex-1 text-sm text-muted-foreground">Owed to you</span>
          <Ghost fig className="text-base font-semibold" w="w-full">₹5,000</Ghost>
          <Icon name="chevron_right" size={20} className="text-muted-foreground" />
        </div>
        <section aria-hidden className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between px-0.5">
            <H2 known={false} className="py-1">Today</H2>
          </div>
          <div className={`${CARD} px-[var(--pad)]`}><Rows n={3} /></div>
        </section>
      </div>
    </Frame>
  );
}

type View = 'all' | 'review' | 'upcoming' | 'sms';
const CHIPS: { key: View; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'review', label: 'To review' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'sms', label: 'From SMS' },
];

/** The month pill (MonthPill), drawn: the two arrows and the month, on a card ground. */
function MonthPillStill() {
  return (
    <div className="flex flex-none items-center rounded-full border border-border bg-card text-muted-foreground">
      <span className="grid size-11 place-items-center"><Icon name="chevron_left" size={20} /></span>
      <Ghost className="min-w-[76px] text-center text-sm font-semibold" w="w-full">{monthNow('short')}</Ghost>
      <span className="grid size-11 place-items-center"><Icon name="chevron_right" size={20} /></span>
    </div>
  );
}

/** Activity, by chip: the title, the line under it, the month pill on All, the four chips, then the view. */
function Activity({ stillBar, view }: Draw & { view: View }) {
  const chips = (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {CHIPS.map((c) => (
        <span key={c.key} className={`flex min-h-11 min-w-11 flex-none items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-sm in-data-[platform=android]:min-h-12 ${c.key === view
          ? 'border-primary bg-primary font-semibold text-primary-foreground' : 'border-border bg-card font-medium text-foreground'}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
  return (
    <Frame name="activity" current="/entries" space="bar" stillBar={stillBar}>
      <TabHead title="Activity" line="10 entries · ₹11,609 spent" right={view === 'all' ? <MonthPillStill /> : undefined} below={chips} />
      <div className="pb-6">
        {view === 'all' && (
          <div className="pt-3">
            <div className="flex flex-col gap-1.5 px-[var(--gutter)] pb-3">
              <span className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-muted-foreground in-data-[platform=android]:min-h-12">
                <Icon name="search" size={18} />
                <span className="py-2 text-muted-foreground">Search, or press Enter for every month</span>
              </span>
              <div className="-mx-2 flex flex-wrap">
                {['All', 'Spent', 'Came in', 'Moved'].map((k) => (
                  <span key={k} className="flex min-h-11 items-center px-2"><Ghost className="text-[13px]" w="w-full">{k}</Ghost></span>
                ))}
              </div>
            </div>
            {[2, 2].map((n, d) => (
              <section key={d} aria-hidden className="mb-4 flex flex-col gap-1.5">
                <H2 known={false} className="mx-[var(--gutter)] px-0.5">Today</H2>
                <div className={`mx-[var(--gutter)] ${CARD} px-[var(--pad)]`}><Rows n={n} /></div>
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
                <div className={`mx-[var(--gutter)] ${CARD} px-[var(--pad)]`}><Rows n={n} h={view === 'upcoming' ? 'h-[94px] py-2.5' : 'min-h-[72px] py-2.5'} /></div>
              </section>
            ))}
            {view === 'sms' && (
              <div className={`mx-[var(--gutter)] flex flex-col items-center gap-3 rounded-[18px] bg-card px-6 py-8`}>
                <S className="size-8 rounded-full" />
                <Ghost as="p" className="max-w-[32ch] text-center text-sm leading-relaxed" w="w-full">
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
        <div className="mx-[var(--gutter)] mb-4 flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]">
          {[88, 122, 80, 327, 74, 74].map((h, i) => (
            <span key={i} className="flex flex-col gap-1.5" style={{ height: h }}>
              <Ghost className="text-[13px] font-medium" w="w-1/4">Amount</Ghost>
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
  void stillBar;
  return (
    <main aria-busy="true" data-frame="skip-label" className="flex min-h-dvh flex-col bg-background text-foreground">
      <span className="sr-only" aria-live="polite">Loading a new entry</span>
      <header className="flex flex-none flex-col gap-1 px-[var(--gutter)] pt-2">
        <div className="flex items-center justify-between gap-2">
          <span className="-ml-2.5 flex size-11 items-center justify-center in-data-[platform=android]:size-12"><Icon name="close" size={24} /></span>
          <div className="flex rounded-xl bg-muted p-[3px]">
            {['Expense', 'Income', 'Move'].map((k, i) => (
              <span key={k} className={`grid min-h-11 place-items-center rounded-[10px] px-3.5 text-sm ${i === 0 ? 'bg-raised font-semibold text-foreground shadow-sm' : 'font-medium text-muted-foreground'}`}>{k}</span>
            ))}
          </div>
          <span className="-mr-2.5 size-11 in-data-[platform=android]:size-12" />
        </div>
        {/* The amount: the currency is the household's, not known to a frame, so the whole line is a ghost. */}
        <div className="flex min-w-0 items-baseline justify-center gap-1.5 py-2">
          <Ghost className="text-[52px] font-bold leading-tight tracking-tight" w="w-full">₹0.00</Ghost>
        </div>
        <p className="-mt-1 mb-1 min-h-5" />
      </header>
      <div className="flex flex-1 flex-col gap-4 px-[var(--gutter)] pb-4 pt-2">
        <section aria-hidden className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Category · your most used</span>
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
                  <span className="text-xs">{t}</span>
                  <Ghost className="text-[15px] font-medium" w="w-1/2">GPay · HDFC Savings</Ghost>
                </span>
              ) : <span className="flex-1 text-[15px]">Note, bill, tab, shared…</span>}
              <Icon name="expand_more" size={20} />
            </span>
          ))}
        </div>
      </div>
      <div className="sticky bottom-0 z-10 flex-none border-t border-border bg-background px-[var(--gutter)] pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
        <span className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-primary-foreground opacity-45">Save</span>
      </div>
    </main>
  );
}

/** Loans: the title and New tab, Owed to you, then the open tabs. */
function Loans({ stillBar }: Draw) {
  return (
    <Frame name="loans" current="/people" space="bar" stillBar={stillBar}>
      <Head title="Loans" right={<S className="h-11 w-[116px] rounded-full in-data-[platform=android]:h-12" />} />
      <div className="flex flex-col gap-5 px-[var(--gutter)] pb-6">
        <FigureCard />
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>Open tabs</H2>
          <div className={`${CARD} px-[var(--pad)]`}><Rows n={4} chip="size-10 rounded-full" second="2 costs · last cost 3 Nov" /></div>
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
        <div className="mx-[var(--gutter)] flex gap-2">
          <S className="h-[54px] flex-1 rounded-2xl" />
          <S className="h-[54px] flex-1 rounded-2xl" />
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <H2 known={false}>Shared costs</H2>
          <div className={CARD}><Rows n={3} chip={null} pad="px-3.5" /></div>
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
          <div aria-hidden className="flex flex-wrap gap-2">
            {['w-[120px]', 'w-[104px]', 'w-[132px]', 'w-[96px]'].map((w) => <S key={w} className={`h-11 rounded-full ${w}`} />)}
          </div>
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <H2 known={false}>November</H2>
          <div className={`${CARD} px-[var(--pad)]`}><Rows n={2} h="min-h-[72px] py-2.5" /></div>
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
      <TabHead title="Wealth" line="Household" lineFirst right={<S className="size-11 rounded-full in-data-[platform=android]:size-12" />} />
      <div className="flex flex-col gap-4">
        <div aria-hidden className="flex flex-wrap gap-2 px-[var(--gutter)]">
          {['Household', 'Ammar', 'Sara', 'Joint'].map((n) => (
            <span key={n} className="flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm">
              <Ghost w="w-full">{n}</Ghost>
            </span>
          ))}
        </div>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-3 rounded-[22px] bg-hero p-[18px] text-hero-foreground">
          <span className="text-[13px] text-hero-muted">Household net worth</span>
          <Ghost fig className="text-[38px] font-bold leading-none tracking-tight" w="w-1/2">₹12,34,567</Ghost>
          <S className="h-2.5 w-full rounded-full opacity-40" />
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {[0, 1, 2, 3].map((i) => <Ghost key={i} className="h-5" w="w-4/5">Bank and cash ₹1,000</Ghost>)}
          </div>
          <p className="border-t border-hero-foreground/15 pt-2 text-xs">
            <Ghost className="h-5" w="w-full">Less cards and money owed</Ghost>
          </p>
        </section>
        <section aria-hidden className="mx-[var(--gutter)] flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 px-0.5"><H2 known={false} className="">Pots in other currencies</H2></div>
          <div className={CARD}><Rows n={3} h="min-h-16 py-2.5" pad="px-3.5" chip="size-9 rounded-full" /></div>
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
        <Ghost as="p" className="text-sm" w="w-2/5">Pots in other currencies</Ghost>
        <Ghost as="div" title className="text-[28px] font-bold leading-tight tracking-tight" w="w-3/5">Holding</Ghost>
      </header>
      <div className="flex flex-col gap-4 px-[var(--gutter)]">
        <FigureCard tone="hero" label="Joint · Dirhams" lines={['1,000 AED on 6 Nov']} line="text-sm" />
        <div className="flex min-h-14 items-center gap-3 rounded-[18px] bg-card px-3.5 py-2.5">
          <S className="size-[22px] rounded-md" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Ghost className="text-[15px]" w="w-1/2">1 AED = ₹22.70</Ghost>
            <Ghost className="text-xs" w="w-1/3">Rate from today</Ghost>
          </span>
        </div>
        <div className="flex gap-2">
          <S className="h-12 flex-1 rounded-xl" />
          <S className="h-12 flex-1 rounded-xl" />
        </div>
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>History</H2>
          <div className={CARD}><Rows n={2} chip={null} amount="AED 1,000" h="py-3" pad="px-3.5" second={null} /></div>
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
        <div className="flex flex-col gap-3 rounded-[22px] bg-card p-[18px]">
          <span className="flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">Net worth</span>
            <Icon name="chevron_right" size={20} className="text-muted-foreground" />
          </span>
          <Ghost fig className="text-[38px] font-bold leading-none tracking-tight" w="w-1/2">₹12,34,567</Ghost>
          <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
            {['Held', 'Owed to you', 'You owe'].map((t) => (
              <span key={t} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t}</span>
                <Ghost fig className="text-sm font-semibold" w="w-4/5">₹1,23,456</Ghost>
              </span>
            ))}
          </div>
        </div>
        <section aria-hidden className="flex flex-col gap-1.5">
          <H2>Bank and cash</H2>
          <div className={CARD}><Rows n={3} chip="size-[38px] rounded-full" h="min-h-[72px] py-3" pad="px-[var(--pad)]" second="UPI · Debit card" /></div>
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
        <div className={CARD}>
          <Rows n={5} chip="size-[38px] rounded-full" h="h-[87px] py-3" pad="px-[var(--pad)]" second="Never matched · 12 entries to check" />
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
        <div className="mx-[var(--gutter)]"><FigureCard label="In the books today" size="text-[34px]" lines={[]} gap="gap-1.5" /></div>
        <div className="mx-[var(--gutter)] flex h-[224px] flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]">
          <Ghost className="text-[13px] font-medium" w="w-1/3">Statement</Ghost>
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
          <LeftToSpendStill size="text-[38px]" />
          <section aria-hidden className="flex flex-col gap-1.5">
            <H2>By category</H2>
            <div className={CARD}><Rows n={4} chip="size-9 rounded-xl" pad="px-[var(--pad)]" /></div>
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
          <div className={CARD}><Rows n={10} chip="size-9 rounded-full" pad="px-[var(--pad)]" second={null} amount={null} h="min-h-[72px] py-2" /></div>
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
          <H2>Your account</H2>
          <div className={`${CARD} [&>*+*]:border-t [&>*+*]:border-border`}>
            {[66, 79, 59, 62, 70, 71].map((h, i) => (
              <div key={h} className="flex flex-col justify-center" style={{ height: h }}>
                <Row i={i} chip={i ? 'size-[38px] rounded-full' : 'size-[42px] rounded-full'} h="" pad="px-[var(--pad)]" amount={null}
                  first={i ? 'Sign out' : 'Ammar'} second={i ? 'On this phone only' : 'ammar@example.com · Owner'} last />
              </div>
            ))}
          </div>
        </section>
      </div>
    </Frame>
  );
}

/** SMS capture: how it works, then the phones, adding one, and the set-up guides. */
function Capture({ stillBar }: Draw) {
  return (
    <Frame name="SMS capture" current="/household" space="bar" stillBar={stillBar}>
      <Head back title="SMS capture" sub="Bank messages become drafts to review" />
      <div className="flex flex-col gap-6 px-[var(--gutter)]">
        <div className="flex h-[158px] flex-col gap-2.5 rounded-2xl border border-border bg-card p-4">
          {[0, 1].map((i) => (
            <span key={i} className="flex items-start gap-2.5">
              <S className="mt-0.5 size-[18px] rounded-full" />
              <Ghost as="span" className="flex-1 text-sm leading-relaxed" w="w-full">A phone forwards a bank message here and it becomes a draft.</Ghost>
            </span>
          ))}
        </div>
        <section aria-hidden className="flex flex-col gap-2">
          <div className="flex min-h-6 items-baseline justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phones in this household</h2>
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
        <div className="flex flex-col gap-3.5 rounded-[18px] bg-card p-[var(--pad)]">
          <Ghost as="p" className="text-sm leading-normal" w="w-full">Scanning needs a key from Google, which the household owner adds under Household. It is free for this many receipts.</Ghost>
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
        <div className={CARD}><Rows n={16} chip="size-[22px] rounded-md" second={null} amount={null} h="min-h-14 py-3" pad="px-[var(--pad)]" /></div>
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
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">The message</h2>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <Ghost as="p" className="text-sm leading-relaxed" w="w-full">Rs 1,250.00 spent on your HDFC Bank card ending 8802 at the market on 06-11-26. Not you? Call the bank.</Ghost>
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
