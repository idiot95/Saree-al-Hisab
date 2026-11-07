import { categoriesFor, schedulesFor, tabsForEntry, type ScheduleRow } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { waysToPay } from '@/db/payment';
import { format } from '@/lib/money';
import { daysBetween, describeRule, isFinished, nextUnsettled, outstandingDues, parseRule, ruleOf } from '@/lib/recur';
import NewSchedule from '../schedules/NewSchedule';
import Calendar, { type CalSchedule } from '../schedules/Calendar';
import DueRow from '../schedules/DueRow';
import { archiveSchedule } from '../schedules/actions';
import Swipeable from '../Swipeable';
import { Chip } from '../Icon';
import { Empty, Section } from './parts';

/* Activity › Upcoming: what comes round anyway — rent, fees, an EMI, a salary. What is due in the next fortnight
   first, then the month as a calendar (folded to one line until tapped, and paged on the phone: it keeps its own
   month, apart from the month pill All uses), every schedule, and the finished ones. `startOpen` opens the form
   to add one, which is what the empty state's action asks for, so it works as a plain link. */
export async function loadUpcoming(hh: string, canWrite: boolean, startOpen: boolean) {
  const [schedules, ways, cats, tabs] = await withHousehold(hh, () => Promise.all([
    schedulesFor(hh),
    waysToPay(hh),
    categoriesFor(hh),
    tabsForEntry(hh),
  ]));
  const today = new Date();
  const dues = outstandingDues(schedules, today, 14);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  /* A schedule with an end that has passed is finished: it stays listed, quietly, until someone removes it — the
     entries it raised are still in the ledger — but it no longer counts towards what a month costs. */
  const live = schedules.filter((s) => !isFinished(s, today));
  const finished = schedules.filter((s) => isFinished(s, today));
  const monthlyOf = (kind: 'expense' | 'income') => live
    .filter((s) => s.kind === kind && parseRule(ruleOf(s)?.rule ?? '', ruleOf(s)?.cal)?.freq === 'MONTHLY')
    .reduce((n, s) => n + Number(s.amount ?? 0), 0);
  const out = monthlyOf('expense');
  const income = monthlyOf('income');
  const todayIso = isoOf(today);
  // The calendar takes finished schedules too: their past still happened, and a month gone should still show it.
  const forCalendar: CalSchedule[] = schedules.flatMap((s) => {
    const r = ruleOf(s);
    return r ? [{
      id: s.id, name: s.name, kind: s.kind, amount: Number(s.amount ?? 0), category: s.category,
      icon: s.icon, tint: s.tint, rule: r.rule, cal: r.cal, since: s.since, occurrences: s.occurrences,
    }] : [];
  });

  const sub = schedules.length === 0
    ? 'Nothing scheduled yet'
    : [out > 0 ? `${format(out)} a month goes out` : null, income > 0 ? `${format(income)} comes in` : null]
        .filter(Boolean).join(' · ') || `${schedules.length} scheduled`;

  const body = (
    <div className="flex flex-col gap-5">
      {schedules.length === 0 && !startOpen && (
        <Empty icon="event_repeat"
          text="Rent, fees, an EMI, a salary: the things that come round whether you look or not. Add one and it shows up here, on the calendar, and on Home the day it is due. Nothing is recorded until you say it was paid."
          action={canWrite ? { href: '/entries?f=upcoming&new=1', label: 'Add a regular payment', icon: 'add', replace: true } : undefined} />
      )}
      {dues.length > 0 && (
        <Section title="Due in the next two weeks">
          <div className="overflow-hidden rounded-[18px] bg-card px-[var(--pad)]">
            {dues.map((d) => {
              const s = byId.get(d.scheduleId)!;
              return (
                <DueRow key={`${d.scheduleId}:${d.dueOn}`}
                  scheduleId={d.scheduleId} name={s.name} kind={s.kind} dueOn={d.dueOn}
                  on={d.on} movedFrom={d.movedFrom}
                  daysAway={d.daysAway} amount={Number(s.amount ?? 0)} category={s.category}
                  icon={s.icon} rule={ruleOf(s)?.rule} cal={ruleOf(s)?.cal} today={todayIso} />
              );
            })}
          </div>
        </Section>
      )}

      {schedules.length > 0 && (
        <section aria-label="The month" className="flex flex-col gap-1.5">
          <h2 className="mx-[var(--gutter)] px-0.5 text-[13px] font-semibold text-muted-foreground">The month</h2>
          <Calendar schedules={forCalendar} canWrite={canWrite} today={todayIso} />
        </section>
      )}

      {live.length > 0 && (
        <Section title="Every regular payment">
          <Rows schedules={live} canWrite={canWrite} today={today} todayIso={todayIso} />
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Finished">
          <Rows schedules={finished} canWrite={canWrite} today={today} todayIso={todayIso} done />
        </Section>
      )}

      {canWrite && (schedules.length > 0 || startOpen) && (
        <NewSchedule startOpen={startOpen} ways={ways} categories={cats}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))} />
      )}

      {schedules.length > 0 && (
        <p className="mx-[var(--gutter)] -mt-2 px-0.5 text-xs leading-relaxed text-muted-foreground">
          Nothing is recorded until you say so. A regular payment is a reminder with the details already filled in,
          not a standing instruction that writes entries behind your back.
        </p>
      )}
    </div>
  );
  return { sub, body };
}

function Rows({ schedules, canWrite, today, todayIso, done = false }: {
  schedules: ScheduleRow[]; canWrite: boolean; today: Date; todayIso: string; done?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded-[18px] bg-card px-[var(--pad)] ${done ? 'opacity-75' : ''}`}>
      {schedules.map((s, i) => {
        const r = ruleOf(s);
        const next = done ? null : nextUnsettled(s, s.settled, today);
        const late = !!next && daysBetween(todayIso, next) < 0;
        // Stop lives in the swipe; the grip at the edge says so, and is its twin.
        return (
          <Swipeable key={s.id} commit={false} actions={canWrite ? [
            { label: done ? 'Remove' : 'Stop', icon: 'stop', tone: 'danger', act: archiveSchedule,
              fields: { scheduleId: s.id }, done: `${s.name} ${done ? 'removed' : 'stopped'}.` },
          ] : []}>
            <div className={`flex min-h-[72px] items-center gap-3 py-2.5 ${i === schedules.length - 1 ? '' : 'border-b border-border'}`}>
              <Chip icon={s.icon ?? 'autodebit'} tint={s.tint} size={40} radius={12} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-medium [overflow-wrap:anywhere]">{s.name}</span>
                <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {r ? cap(describeRule(r.rule, r.cal)) : 'No schedule'}
                  {s.category ? ` · ${s.category}` : ''}
                </span>
                {r && !done && (
                  <span className={`text-xs ${next ? 'font-semibold' : ''} ${late ? 'text-destructive' : next ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {next ? nextIn(todayIso, next) : 'Nothing more to come'}
                  </span>
                )}
              </span>
              <span className={`flex-none text-[15px] font-semibold tabular-nums ${s.kind === 'income' ? 'text-money-in' : ''}`}>
                {s.kind === 'income' ? '+' : ''}{format(Number(s.amount ?? 0))}
              </span>
            </div>
          </Swipeable>
        );
      })}
    </div>
  );
}

/** The next date as a count of days — "Due today", "In 27 days", "3 days overdue" — and nothing else: a date needs
 *  a calendar to read, a number of days does not. */
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
