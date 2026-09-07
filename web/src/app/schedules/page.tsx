import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, categoriesFor, methodsFor, schedulesFor } from '@/db/queries';
import { format } from '@/lib/money';
import { describeRule, nextUnsettled, outstandingDues } from '@/lib/recur';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import NewSchedule from './NewSchedule';
import DueRow, { StopSchedule } from './DueRow';
import { archiveSchedule } from './actions';
import Screen from '../Screen';
import SwipeBack from '../SwipeBack';
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
  const dues = outstandingDues(schedules, new Date(), 14);
  const byId = new Map(schedules.map((s) => [s.id, s]));
  const monthlyOf = (kind: 'expense' | 'income') => schedules
    .filter((s) => s.kind === kind && s.rrule?.includes('MONTHLY'))
    .reduce((n, s) => n + Number(s.amount ?? 0), 0);
  const out = monthlyOf('expense');
  const income = monthlyOf('income');

  return (
    <Screen>
      <SwipeBack to="/" />
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

          {schedules.length > 0 && (
            <>
              <Head>Every schedule</Head>
              <section className="el card" style={{
                margin: '0 var(--gutter) 22px', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)', overflow: 'hidden',
              }}>
                {schedules.map((s, i) => (
                  <Swipeable key={s.id} commit={false} actions={canWrite ? [
                    { label: 'Stop', icon: 'stop', tone: 'danger', act: archiveSchedule,
                      fields: { scheduleId: s.id }, done: `${s.name} stopped.` },
                  ] : []}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
                    borderBottom: i === schedules.length - 1 ? undefined : '1px solid var(--c-rule)',
                  }}>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{s.name}</span>
                      <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
                        {s.rrule ? describeRule(s.rrule) : 'no schedule'}
                        {s.rrule && ` · next ${friendly(nextUnsettled(s.rrule, s.settled, new Date()) ?? undefined)}`}
                      </span>
                    </span>
                    <span className="t amt" style={{
                      fontSize: 'var(--step-0)', color: s.kind === 'income' ? 'var(--c-in)' : 'var(--c-out)',
                    }}>{s.kind === 'income' ? '+' : ''}{format(Number(s.amount ?? 0))}</span>
                    {canWrite && <StopSchedule scheduleId={s.id} name={s.name} />}
                  </div>
                  </Swipeable>
                ))}
              </section>
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

function friendly(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 11px' }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>{children}</h2>
      <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
    </div>
  );
}
