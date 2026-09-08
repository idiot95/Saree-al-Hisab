import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, categoriesFor, methodsFor, schedulesFor, type ScheduleRow } from '@/db/queries';
import { formatHijri, toHijri } from '@/lib/hijri';
import { format } from '@/lib/money';
import { describeRule, isFinished, nextUnsettled, outstandingDues, parseRule, ruleOf } from '@/lib/recur';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewSchedule from './NewSchedule';
import DueRow, { StopSchedule } from './DueRow';
import { archiveSchedule } from './actions';
import Screen from '../Screen';
import Back from '../Back';
import Swipeable from '../Swipeable';

export const metadata = { title: 'Scheduled · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Schedules() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const [schedules, methods, cats] = await Promise.all([
    schedulesFor(actor.household_id),
    methodsFor(actor.household_id),
    categoriesFor(actor.household_id),
  ]);
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

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('cyan'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={{
            width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
          }}>
            <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>
            Scheduled
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.84)' }}>
            {schedules.length === 0
              ? 'Rent, fees, an EMI, a salary — the things that come round whether you look or not.'
              : [out > 0 ? `${format(out)} a month goes out` : null,
                 income > 0 ? `${format(income)} comes in` : null]
                  .filter(Boolean).join(' · ')
                || `${schedules.length} ${schedules.length === 1 ? 'schedule' : 'schedules'}`}
          </p>
        </header>

        <div style={{ paddingTop: 20 }}>
          {dues.length > 0 && (
            <>
              <Head>Due now</Head>
              <section className="el card" style={{
                margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)', overflow: 'hidden',
              }}>
                {dues.map((d) => {
                  const s = byId.get(d.scheduleId)!;
                  return (
                    <DueRow key={`${d.scheduleId}:${d.dueOn}`}
                      scheduleId={d.scheduleId} name={s.name} kind={s.kind} dueOn={d.dueOn}
                      daysAway={d.daysAway} amount={Number(s.amount ?? 0)} category={s.category}
                        icon={s.icon} tint={s.tint} />
                  );
                })}
              </section>
            </>
          )}

          {live.length > 0 && (
            <>
              <Head>Every schedule</Head>
              <Rows schedules={live} canWrite={canWrite} today={today} />
            </>
          )}

          {finished.length > 0 && (
            <>
              <Head>Finished</Head>
              <Rows schedules={finished} canWrite={canWrite} today={today} done />
            </>
          )}

          {canWrite && (
            <NewSchedule
              startOpen={schedules.length === 0}
              methods={methods.map((m) => ({ id: m.id, name: m.name, funds: m.funds }))}
              categories={cats.map((c) => ({ id: c.id, name: c.name }))}
            />
          )}

          <p style={{ margin: '0 var(--gutter)', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Nothing is recorded until you say so. A schedule is a reminder with the details
            already filled in, not a standing instruction that writes entries behind your back.
            Income scheduled here is recorded as income when you say it came in.
          </p>
        </div>
        <TabBar current="/schedules" />
      </main>
    </Screen>
  );
}

function Rows({ schedules, canWrite, today, done = false }: {
  schedules: ScheduleRow[]; canWrite: boolean; today: Date; done?: boolean;
}) {
  return (
    <section className="el card" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18,
      padding: '0 var(--pad)', overflow: 'hidden', opacity: done ? 0.72 : 1,
    }}>
      {schedules.map((s, i) => {
        const r = ruleOf(s);
        const next = done ? null : nextUnsettled(s, s.settled, today);
        return (
          <Swipeable key={s.id} commit={false} actions={canWrite ? [
            { label: done ? 'Remove' : 'Stop', icon: 'stop', tone: 'danger', act: archiveSchedule,
              fields: { scheduleId: s.id }, done: `${s.name} ${done ? 'removed' : 'stopped'}.` },
          ] : []}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
            borderBottom: i === schedules.length - 1 ? undefined : '1px solid var(--c-rule)',
          }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{s.name}</span>
              <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                {r ? describeRule(r.rule, r.cal) : 'no schedule'}
              </span>
              {r && !done && (
                <span style={{ fontSize: 'var(--step--1)', color: next ? 'var(--c-ink)' : 'var(--c-meta)' }}>
                  {next ? `next ${friendly(next)}` : 'nothing more to come'}
                  {r.cal === 'hijri' && next && ` · ${hijriOf(next)}`}
                </span>
              )}
            </span>
            <span className="t amt" style={{
              fontSize: 'var(--step-0)', color: s.kind === 'income' ? 'var(--c-in)' : 'var(--c-out)',
            }}>{s.kind === 'income' ? '+' : ''}{format(Number(s.amount ?? 0))}</span>
            {canWrite && <StopSchedule scheduleId={s.id} name={s.name} verb={done ? 'Remove' : 'Stop'} />}
          </div>
          </Swipeable>
        );
      })}
    </section>
  );
}

function friendly(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** "2027-02-06" → "1 Ramadaan 1448": the same day, the way it was asked for. */
function hijriOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return formatHijri(toHijri({ y, m, d }), true);
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}
