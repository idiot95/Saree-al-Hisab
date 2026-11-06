import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import { actorOrNull, claimsFor, entriesFor, inboxCount, reviewCount, monthTotals, peopleFor, schedulesFor, setupProgress } from '@/db/queries';
import { netWorth, owedToYou } from '@/lib/worth';
import { withHousehold } from '@/db/client';
import { worthInput } from '@/db/worth';
import { monthKey } from '@/lib/money';
import { outstandingDues, ruleOf } from '@/lib/recur';
import DueRow from './schedules/DueRow';
import EntryList from './entries/EntryList';
import { toRow } from './entries/rows';
import GettingStarted from './GettingStarted';
import LeftToSpend from './home/LeftToSpend';
import { Figure } from './Figure';
import TabBar from './TabBar';
import { TAB_BAR_SPACE } from './tabs';
import Screen from './Screen';
import SavedSnack from './SavedSnack';
import { Icon } from './Icon';

export const dynamic = 'force-dynamic';

/* Home answers one question — how is this month going — and then gets out of
   the way. Everything else is a way to somewhere else, so it is small, and the
   setup checklist is one line rather than the tall card that used to push the
   answer below the fold. */
export default async function Home({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { saved } = await searchParams;
  const savedId = saved && /^[0-9a-f-]{36}$/.test(saved) ? saved : null;
  const name = actor.household_name;
  const month = monthKey(new Date());
  const hh = actor.household_id;
  /* Home asks only what it shows: the month, what to review and what is coming, the household's net worth (one
     row, the door to Wealth), what is owed to you (one line, the door to Loans), and today. The net worth is read
     the way Wealth reads it (worthInput, then netWorth for the household), so the two never disagree. */
  /* One transaction for everything Home reads, net worth included. Home does not refresh rates (Wealth does);
     it values holdings at the last stored rates. */
  const [progress, totals, inbox, schedules, recent, claims, people, worth] = await withHousehold(hh, () => Promise.all([
    setupProgress(hh),
    monthTotals(hh, month),
    inboxCount(hh),
    schedulesFor(hh),
    entriesFor(hh, month),
    claimsFor(hh),
    peopleFor(hh),
    worthInput(hh, actor.currency, { refreshRates: false }),
  ]));
  const { owed } = owedToYou(claims, people);
  const householdWorth = netWorth(worth.input, { kind: 'household' }).worth;

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  /* What is due today — or should have been already — is asked about here,
     on the screen the household opens first: is it paid, or has it moved?
     What is due later in the week is only counted, and waits in the inbox. */
  const now = new Date();
  const todayIso = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const allDues = outstandingDues(schedules, now, 7);
  const canAct = actor.role !== 'viewer';
  const dueNow = canAct ? allDues.filter((d) => d.daysAway <= 0) : [];
  /* The same count as Activity's "To review" badge, so the two never disagree. What is due comes under Upcoming. */
  const review = reviewCount(inbox);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const monthName = new Date(month).toLocaleDateString('en-IN', { month: 'long' });

  const todays = recent.filter((e) => String(e.occurred_on).slice(0, 10) === todayIso);
  const latest = todays.length ? todays : recent.slice(0, 5);
  const dueSoon = allDues.filter((d) => d.daysAway > 0);
  const dueSoonTotal = dueSoon.reduce((n, d) => n + Number(byId.get(d.scheduleId)?.amount ?? 0), 0);

  /* The second tile is what comes round this week; when nothing does and bank messages are waiting, it is those. */
  const fromSms = dueSoon.length === 0 && inbox.sms > 0;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        {/* The household, the month large, and your initials at the far end — the door to household and settings. */}
        <header className="flex items-end gap-3 px-[var(--gutter)] pb-2 pt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] text-muted-foreground">{name}</p>
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">{monthName}</h1>
          </div>
          <Link href="/household" transitionTypes={['nav-forward']} aria-label="Household and settings"
            className="press grid size-11 flex-none place-items-center rounded-full bg-accent text-[15px] font-semibold text-accent-foreground in-data-[platform=android]:size-12">
            {(actor.user_name || '?').slice(0, 2).toUpperCase()}
          </Link>
        </header>

        {/* A breathing gap, so the last card is not flush against the tab bar — and, while "Entry saved" floats
            above the bar, room enough that the last line can scroll out from under it. */}
        <div className={`flex flex-col gap-4 px-[var(--gutter)] pt-2 ${savedId ? 'pb-20' : 'pb-6'}`}>
          {budget > 0
            ? <LeftToSpend month={month} budget={budget} spent={spent} />
            : <NoBudgetYet spent={spent} entries={progress.entries} />}

          {/* Decisions waiting, and what comes round this week (or the bank messages, when nothing does). */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/inbox" transitionTypes={['nav-forward']}
              className={`press flex min-h-[96px] flex-col gap-1.5 rounded-[18px] p-3.5 ${review > 0
                ? 'bg-attention-soft text-attention-soft-foreground' : 'bg-card'}`}>
              <Icon name="rule" size={22} className={review > 0 ? '' : 'text-primary'} />
              <span className={`text-xs ${review > 0 ? '' : 'text-muted-foreground'}`}>To review</span>
              <span className="text-lg font-semibold leading-tight">
                {review > 0 ? `${review} ${review === 1 ? 'decision' : 'decisions'}` : 'All clear'}
              </span>
            </Link>
            {fromSms ? (
              <Link href="/inbox" transitionTypes={['nav-forward']}
                className="press flex min-h-[96px] flex-col gap-1.5 rounded-[18px] bg-card p-3.5">
                <Icon name="sms" size={22} className="text-primary" />
                <span className="text-xs text-muted-foreground">From SMS</span>
                <span className="text-lg font-semibold leading-tight">
                  {inbox.sms} {inbox.sms === 1 ? 'message' : 'messages'}
                </span>
              </Link>
            ) : (
              <Link href="/schedules" transitionTypes={['nav-forward']}
                className="press flex min-h-[96px] flex-col gap-1.5 rounded-[18px] bg-card p-3.5">
                <Icon name="event_upcoming" size={22} className="text-primary" />
                <span className="text-xs text-muted-foreground">Due this week</span>
                <span className="text-lg font-semibold leading-tight tabular-nums">
                  {dueSoon.length ? <Figure minor={dueSoonTotal} /> : 'Nothing'}
                </span>
              </Link>
            )}
          </div>

          {/* The household's net worth, dark, into Wealth. */}
          <Link href="/worth" transitionTypes={['nav-lateral']}
            className="press flex min-h-[68px] items-center gap-3 rounded-[18px] bg-hero px-4 py-3.5 text-hero-foreground">
            <Icon name="trending_up" size={22} className="text-hero-4" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs text-hero-muted">Household net worth</span>
              <Figure minor={householdWorth} className="text-lg font-semibold leading-tight tabular-nums" />
            </span>
            <Icon name="chevron_right" size={22} className="text-hero-muted" />
          </Link>

          {owed > 0 && (
            <Link href="/people" transitionTypes={['nav-lateral']}
              className="press flex min-h-14 items-center gap-3 rounded-[18px] bg-card px-4">
              <Icon name="group" size={20} className="text-primary" />
              <span className="flex-1 text-sm text-muted-foreground">Owed to you</span>
              <Figure minor={owed} className="text-base font-semibold tabular-nums" />
              <Icon name="chevron_right" size={20} className="text-muted-foreground" />
            </Link>
          )}

          {dueNow.length > 0 && (
            <section aria-label="Due today" className="flex flex-col gap-1">
              <h2 className="px-0.5 py-1 text-[13px] font-semibold text-muted-foreground">
                {dueNow.some((d) => d.daysAway < 0) ? 'Due now' : 'Due today'} · paid, or moved?
              </h2>
              <div className="overflow-hidden rounded-[18px] bg-card px-3.5">
                {dueNow.map((d) => {
                  const s = byId.get(d.scheduleId)!;
                  return (
                    <DueRow key={`${d.scheduleId}:${d.dueOn}`}
                      scheduleId={d.scheduleId} name={s.name} kind={s.kind} dueOn={d.dueOn}
                      on={d.on} movedFrom={d.movedFrom} daysAway={d.daysAway}
                      amount={Number(s.amount ?? 0)} category={s.category} icon={s.icon} tint={s.tint}
                      rule={ruleOf(s)?.rule} cal={ruleOf(s)?.cal} today={todayIso} />
                  );
                })}
              </div>
            </section>
          )}

          <GettingStarted progress={{ ...progress, budget }} budgetAskedAbove={budget <= 0} />

          {latest.length > 0 && (
            <section aria-label={todays.length ? 'Today' : 'Latest'} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between px-0.5">
                <h2 className="py-1 text-[13px] font-semibold text-muted-foreground">{todays.length ? 'Today' : 'Latest'}</h2>
                <Link href="/entries" transitionTypes={['nav-lateral']} className="-my-3 flex min-h-11 items-center px-1 text-sm font-medium text-primary">See all</Link>
              </div>
              <EntryList days={[{ on: todayIso, label: '', rows: latest.map(toRow) }]} canEdit={canAct} flat />
            </section>
          )}

          <Link href="/guide" transitionTypes={['nav-forward']} className="flex min-h-11 items-center self-center px-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
            How the app works
          </Link>
        </div>
        {savedId && <SavedSnack id={savedId} />}
        <TabBar current="/" />
      </main>
    </Screen>
  );
}

/* Without a budget there is still something true to say — what the month has cost so far — and the card is the
   door to setting one. */
function NoBudgetYet({ spent, entries }: { spent: number; entries: number }) {
  return (
    <Link href="/budget" transitionTypes={['nav-forward']}
      className="press flex min-h-[72px] items-center gap-3 rounded-[22px] bg-card p-[18px] text-card-foreground">
      <span className="grid size-10 flex-none place-items-center rounded-xl bg-accent text-accent-foreground">
        <Icon name="calendar_month" size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold">Set this month’s budget</span>
        <span className="text-xs text-muted-foreground">
          {entries === 0
            ? 'Nothing recorded yet.'
            : <><Figure minor={spent} /> spent so far, across {entries} {entries === 1 ? 'entry' : 'entries'}.</>}
        </span>
      </span>
      <Icon name="chevron_right" size={20} className="text-muted-foreground" />
    </Link>
  );
}
