import { Suspense } from 'react';
import { SkeletonFor } from '../Skeleton';
import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { actorOrNull, budgetFor, entriesFor, inboxCount, monthTotals, purgeSmsBodies, searchEntries } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { digitsOf, format, monthKey } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import Screen from '../Screen';
import EntryList from './EntryList';
import ActivityChips, { type ActivityFilter } from './ActivityChips';
import { byDay } from './rows';
import MonthPill from '../MonthPill';
import { Icon } from '../Icon';
import { Empty } from './parts';
import { chip, chipRow } from '../form-bits';
import { loadReview } from './ReviewView';
import { loadUpcoming } from './UpcomingView';
import { loadSms } from './SmsView';

export const metadata = { title: 'Activity · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const FILTERS = new Set<ActivityFilter>(['all', 'review', 'upcoming', 'sms']);
const monthLabel = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

type Params = { m?: string; c?: string; q?: string; f?: string; dismissed?: string; new?: string };

/* Activity is one screen: the month's entries, and three other views of the same books chosen by the chips under
   the title — what wants a decision (To review), what comes round next (Upcoming) and the bank messages a phone
   forwarded (From SMS). `?f=` picks the view and every chip is a link, so it all works without script. The month
   pill and search belong to All; Upcoming keeps its own month in its calendar, and what waits for a decision
   waits whatever the month. */
export default async function Activity({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');
  const sp = await searchParams;
  /* loading.tsx cannot see the address's query, so on its own it would draw All's frame over every chip. The
     chip is known here before anything is read, so the frame the server streams is the chip's own. */
  const view = FILTERS.has(sp.f as ActivityFilter) ? sp.f : 'all';
  return (
    <Suspense fallback={<SkeletonFor path={`/entries?f=${view}`} />}>
      <ActivityScreen sp={sp} />
    </Suspense>
  );
}

async function ActivityScreen({ sp }: { sp: Params }) {
  const actor = await actorOrNull();
  if (!actor?.household_id) redirect('/no-household');
  const f: ActivityFilter = FILTERS.has(sp.f as ActivityFilter) ? sp.f as ActivityFilter : 'all';
  const hh = actor.household_id;
  const canWrite = actor.role !== 'viewer';
  const month = sp.m && MONTH.test(sp.m) ? sp.m : null;
  const words = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : '';
  const shown = month ?? monthKey(new Date());
  const categoryId = sp.c && /^[0-9a-f-]{36}$/.test(sp.c) ? sp.c : null;
  /* Forwarded bank messages lose their text once handled or after thirty days, and there is no scheduler, so the
     screen that lists them does it — From SMS, after the response has gone (`after`), so it never holds the screen
     up. Not on the other chips: All is prefetched whole by the tab bar (NavLink), and a prefetch must never write.
     The message screen (which shows a body) and every arrival at the capture endpoint purge too. */
  if (f === 'sms') after(() => purgeSmsBodies(hh));
  /* One transaction for the screen: the counts for the chips' badges — card bills and duplicates on To review, open
     drafts on From SMS, together Home's tile — and the reads of the one view on screen. The loaders' own
     withHousehold joins this scope. */
  const { inbox, view, all, found } = await withHousehold(hh, async () => {
    const inbox = await inboxCount(hh);
    const view = f === 'review' ? await loadReview(hh, canWrite, inbox.sms)
      : f === 'upcoming' ? await loadUpcoming(hh, canWrite, sp.new === '1')
      : f === 'sms' ? await loadSms(hh, canWrite, sp.dismissed)
      : null;
    const found = f === 'all' && words ? await searchEntries(hh, words, amountOf(words, actor.currency)) : null;
    const all = f !== 'all' || words ? null : await Promise.all([
      entriesFor(hh, shown, categoryId),
      budgetFor(hh, shown),
      monthTotals(hh, shown),
    ]);
    return { inbox, view, all, found };
  });
  const review = inbox.bills + inbox.duplicates;
  const chips = <ActivityChips current={f} review={review} sms={inbox.sms} month={month} />;

  if (view) return <Shell sub={view.sub} chips={chips}>{view.body}</Shell>;
  if (found || !all) return <Search entries={found ?? []} words={words} canEdit={canWrite} chips={chips} />;

  const [entries, categories, totals] = all;
  const filtered = categories.find((x) => x.category_id === categoryId)
    ?? categories.flatMap((x) => x.kids.map((k) => ({ ...k, name: `${x.name} › ${k.name}` })))
      .find((k) => k.id === categoryId);
  const days = byDay(entries);

  /* What the month cost comes from spend_txn, never from adding up the rows on screen. A cost laid out for
     someone shows here as the payment that happened, and none of it is spending — summing the list would count it. */
  const spent = filtered ? Number(filtered.spent) : Number(totals.spent);
  const keep = categoryId ? `&c=${categoryId}` : '';

  return (
    <Shell title={filtered ? filtered.name : 'Activity'}
      sub={<><span className="whitespace-nowrap">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·</span>
        {' '}<span className="whitespace-nowrap">{format(spent)} spent</span></>}
      right={<MonthPill month={shown} path="/entries" keep={keep} />}
      chips={filtered ? (
        /* One category, from a budget line: the chips would mean "all of Activity", so the way out is one chip. */
        <div className={chipRow}>
          <Link href={`/entries?m=${shown}`} replace data-replace
            className={`${chip} border-accent bg-accent text-accent-foreground`}>
            <Icon name="close" size={16} /> Showing one category
          </Link>
        </div>
      ) : chips}>
      {entries.length === 0 ? (
        <div className="pt-3">
          <Empty icon="receipt_long"
            text={`Nothing recorded for ${monthLabel(shown)}${filtered ? ` under ${filtered.name}` : ''} yet. Everything spent, earned or moved shows up here, a day at a time.`}
            action={canWrite ? { href: '/add', label: 'Add an entry', icon: 'add' } : undefined} />
        </div>
      ) : (
        <EntryList days={days} canEdit={canWrite} tools />
      )}
    </Shell>
  );
}

/* Postel: "1,250", "₹1250" and "1250" are the same figure — a search that is a number also matches amounts. */
function amountOf(words: string, currency: string) {
  const figure = words.replace(/[^0-9.]/g, '');
  return /^\d+(\.\d+)?$/.test(figure) && /^[\s₹$€£,.\d]+$/.test(words)
    ? Math.round(Number(figure) * 10 ** digitsOf(currency)) : null;
}

/* Every month at once: what was typed, matched against the words on an entry (and its amount, when it is a number),
   newest first. */
function Search({ entries, words, canEdit, chips }: {
  entries: Awaited<ReturnType<typeof searchEntries>>; words: string; canEdit: boolean; chips: React.ReactNode;
}) {
  const days = byDay(entries);
  return (
    <Shell sub={`${entries.length === 0 ? 'Nothing found' : `${entries.length}${entries.length >= 200 ? '+' : ''} found`} in every month`}
      chips={<>
        {chips}
        <div className={chipRow}>
          <Link href="/entries" replace data-replace
            className={`${chip} border-accent bg-accent text-accent-foreground`}>
            <Icon name="close" size={16} /> Back to this month
          </Link>
        </div>
      </>}>
      <EntryList days={days} canEdit={canEdit} tools initialQ={words} everyMonth />
    </Shell>
  );
}

/* The header every view shares — the title large, a line under it, the month pill where it applies, then the
   chips — and the breathing gap above the tab bar. */
function Shell({ title = 'Activity', sub, right, chips, children }: {
  title?: string; sub: React.ReactNode; right?: React.ReactNode; chips: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <header className="flex flex-col gap-3 px-[var(--gutter)] pb-3 pt-4">
          {/* The month pill sits on the title's line, centred on it, at the chips' height. */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <h1 className="min-w-0 text-large-title font-bold leading-tight tracking-tight [overflow-wrap:anywhere]">{title}</h1>
              {right}
            </div>
            <p className="text-subhead text-muted-foreground">{sub}</p>
          </div>
          {chips}
        </header>
        <div className="pb-6">{children}</div>
        <TabBar current="/entries" />
      </main>
    </Screen>
  );
}
