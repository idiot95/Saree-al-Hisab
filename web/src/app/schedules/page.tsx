import { redirect } from 'next/navigation';
import { actorOrNull, categoriesFor, inboxCount, schedulesFor, tabsForEntry, type ScheduleRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import { format } from '@/lib/money';
import { daysBetween, describeRule, isFinished, nextUnsettled, outstandingDues, parseRule, ruleOf } from '@/lib/recur';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewSchedule from './NewSchedule';
import Calendar, { type CalSchedule } from './Calendar';
import DueRow from './DueRow';
import { archiveSchedule } from './actions';
import Screen from '../Screen';
import PageHead, { Label } from '../PageHead';
import ActivityNav from '../entries/ActivityNav';
import { IconCalendarRepeat } from '@tabler/icons-react';
import Swipeable from '../Swipeable';

export const metadata = { title: 'Upcoming · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Schedules() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const hh = actor.household_id;
  const [schedules, ways, cats, tabs, inbox] = await withHousehold(hh, () => Promise.all([
    schedulesFor(hh),
    waysToPay(hh),
    categoriesFor(hh),
    tabsForEntry(hh),
    inboxCount(hh),
  ]));
  const canWrite = actor.role !== 'viewer';
  const today = new Date();
  const dues = outstandingDues(schedules, today, 14);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  /* A schedule with an end that has passed is finished: it stays listed,
     quietly, until someone stops it — the entries it raised are still in
     the ledger and the name still means something — but it no longer counts
     towards what a month costs. */
  const live = schedules.filter((s) => !isFinished(s, today));
  const finished = schedules.filter((s) => isFinished(s, today));
  const monthlyOf = (kind: 'expense' | 'income') => live
    .filter((s) => s.kind === kind && parseRule(ruleOf(s)?.rule ?? '', ruleOf(s)?.cal)?.freq === 'MONTHLY')
    .reduce((n, s) => n + Number(s.amount ?? 0), 0);
  const out = monthlyOf('expense');
  const income = monthlyOf('income');
  const todayIso = isoOf(today);
  // What the calendar needs of each schedule, finished ones included: their
  // past still happened, and a month already gone should still show it.
  const forCalendar: CalSchedule[] = schedules.flatMap((s) => {
    const r = ruleOf(s);
    return r ? [{
      id: s.id, name: s.name, kind: s.kind, amount: Number(s.amount ?? 0), category: s.category,
      icon: s.icon, tint: s.tint, rule: r.rule, cal: r.cal, since: s.since, occurrences: s.occurrences,
    }] : [];
  });

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead title="Activity" sub={schedules.length === 0
          ? 'Nothing scheduled yet'
          : [out > 0 ? `${format(out)} a month goes out` : null, income > 0 ? `${format(income)} comes in` : null]
              .filter(Boolean).join(' · ') || `${schedules.length} scheduled`}>
          <ActivityNav current="schedules" review={inbox.duplicates + inbox.bills} />
        </PageHead>

        <div className="flex flex-col">
          {schedules.length === 0 && (
            <div className="mx-[var(--gutter)] mb-4 flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4">
              <IconCalendarRepeat size={24} className="text-primary" aria-hidden />
              <p className="text-[15px] font-semibold">Rent, fees, an EMI, a salary</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The things that come round whether you look or not. Add one and it shows up here, on the calendar,
                and on Home the day it is due. Nothing is recorded until you say it was paid.
              </p>
            </div>
          )}
          {dues.length > 0 && (
            <>
              <Head>Due now</Head>
              <section className="mx-[var(--gutter)] mb-5 overflow-hidden rounded-2xl border border-border bg-card px-4">
                {dues.map((d) => {
                  const s = byId.get(d.scheduleId)!;
                  return (
                    <DueRow key={`${d.scheduleId}:${d.dueOn}`}
                      scheduleId={d.scheduleId} name={s.name} kind={s.kind} dueOn={d.dueOn}
                      on={d.on} movedFrom={d.movedFrom}
                      daysAway={d.daysAway} amount={Number(s.amount ?? 0)} category={s.category}
                      icon={s.icon} tint={s.tint} rule={ruleOf(s)?.rule} cal={ruleOf(s)?.cal} today={todayIso} />
                  );
                })}
              </section>
            </>
          )}

          {schedules.length > 0 && (
            <>
              <Head>The month</Head>
              <Calendar schedules={forCalendar} canWrite={canWrite} today={todayIso} />
            </>
          )}

          {live.length > 0 && (
            <>
              <Head>Every schedule</Head>
              <Rows schedules={live} canWrite={canWrite} today={today} todayIso={todayIso} />
            </>
          )}

          {finished.length > 0 && (
            <>
              <Head>Finished</Head>
              <Rows schedules={finished} canWrite={canWrite} today={today} todayIso={todayIso} done />
            </>
          )}

          {canWrite && (
            <NewSchedule
              startOpen={false}
              ways={ways}
              categories={cats}
              tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
            />
          )}

          {schedules.length > 0 && (
            <p className="mx-[var(--gutter)] mt-3 px-1 text-xs leading-relaxed text-muted-foreground">
              Nothing is recorded until you say so. A schedule is a reminder with the details
              already filled in, not a standing instruction that writes entries behind your back.
            </p>
          )}
        </div>
        <TabBar current="/schedules" />
      </main>
    </Screen>
  );
}

function Rows({ schedules, canWrite, today, todayIso, done = false }: {
  schedules: ScheduleRow[]; canWrite: boolean; today: Date; todayIso: string; done?: boolean;
}) {
  return (
    <section className="mx-[var(--gutter)] mb-5 overflow-hidden rounded-2xl border border-border bg-card px-4"
      style={{ opacity: done ? 0.72 : 1 }}>
      {schedules.map((s, i) => {
        const r = ruleOf(s);
        const next = done ? null : nextUnsettled(s, s.settled, today);
        // Stop lives in the swipe; the grip at the edge says so.
        return (
          <Swipeable key={s.id} commit={false} actions={canWrite ? [
            { label: done ? 'Remove' : 'Stop', icon: 'stop', tone: 'danger', act: archiveSchedule,
              fields: { scheduleId: s.id }, done: `${s.name} ${done ? 'removed' : 'stopped'}.` },
          ] : []}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 74, padding: '10px 0',
            borderBottom: i === schedules.length - 1 ? undefined : '1px solid var(--border)',
          }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600, overflowWrap: 'anywhere' }}>{s.name}</span>
              <span style={{ fontSize: 'var(--step--1)', color: 'var(--muted-foreground)', overflowWrap: 'anywhere' }}>
                {r ? cap(describeRule(r.rule, r.cal)) : 'No schedule'}
                {s.category ? ` · ${s.category}` : ''}
              </span>
              {r && !done && (
                <span style={{
                  fontSize: 'var(--step--1)', fontWeight: next ? 600 : 400,
                  color: next ? (daysBetween(todayIso, next) < 0 ? 'var(--money-out)' : 'var(--foreground)') : 'var(--muted-foreground)',
                }}>
                  {next ? nextIn(todayIso, next) : 'Nothing more to come'}
                </span>
              )}
            </span>
            <span className="t amt" style={{
              flex: 'none', fontSize: 'var(--step-0)', color: s.kind === 'income' ? 'var(--money-in)' : 'var(--money-out)',
            }}>{s.kind === 'income' ? '+' : ''}{format(Number(s.amount ?? 0))}</span>
          </div>
          </Swipeable>
        );
      })}
    </section>
  );
}

/** The next date as a count of days — "Due today", "In 27 days", "3 days
 *  overdue" — and nothing else: a date needs a calendar to read, a number
 *  of days does not. */
function nextIn(today: string, next: string) {
  const gap = daysBetween(today, next);
  if (gap === 0) return 'Due today';
  if (gap === 1) return 'Due tomorrow';
  if (gap > 1) return `In ${gap} days`;
  return gap === -1 ? '1 day overdue' : `${-gap} days overdue`;
}

function isoOf(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Head({ children }: { children: React.ReactNode }) {
  return <div className="mx-[var(--gutter)] mb-2"><Label>{children}</Label></div>;
}
