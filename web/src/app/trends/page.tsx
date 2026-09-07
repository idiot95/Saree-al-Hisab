import Link from 'next/link';
import { Chip } from '../Icon';
import { redirect } from 'next/navigation';
import { actorOrNull, categoryTrend, monthlySeries } from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import { MonthBars, CategoryDonut } from './charts';
import Screen from '../Screen';
import SwipeBack from '../SwipeBack';

export const metadata = { title: 'Trends · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Trends() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const month = monthKey(new Date());
  const [series, cats] = await Promise.all([
    monthlySeries(actor.household_id, 6),
    categoryTrend(actor.household_id, month),
  ]);

  const withSpend = series.filter((p) => Number(p.spent) > 0);
  const average = withSpend.length
    ? Math.round(withSpend.reduce((n, p) => n + Number(p.spent), 0) / withSpend.length)
    : 0;
  const thisMonth = Number(series[series.length - 1]?.spent ?? 0);
  const lastMonth = Number(series[series.length - 2]?.spent ?? 0);

  const slices = cats
    .filter((c) => Number(c.now) > 0)
    .map((c) => ({ id: c.id, name: c.name, amount: Number(c.now), tint: c.tint, icon: c.icon }))
    .sort((a, b) => b.amount - a.amount);
  const sliceTotal = slices.reduce((n, s) => n + s.amount, 0);

  const movers = cats
    .map((c) => ({ ...c, delta: Number(c.now) - Number(c.before) }))
    .filter((c) => c.delta !== 0 && (Number(c.now) > 0 || Number(c.before) > 0))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const nothing = sliceTotal === 0 && withSpend.length === 0;

  return (
    <Screen>
      <SwipeBack to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('green'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 11,
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
          <h1 className="t" style={{ margin: 0, fontSize: 'var(--step-3)', letterSpacing: '-.018em' }}>Trends</h1>
          {!nothing && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'rgba(255,255,255,.84)' }}>
              {average > 0 && `${format(average)} a month on average`}
              {lastMonth > 0 && thisMonth > 0 && (
                thisMonth > lastMonth
                  ? ` · ${format(thisMonth - lastMonth)} more than last month`
                  : ` · ${format(lastMonth - thisMonth)} less than last month`
              )}
            </p>
          )}
        </header>

        {nothing ? (
          <p style={{
            margin: '40px 34px', textAlign: 'center', fontSize: 'var(--step-0)', lineHeight: 1.55,
            color: 'var(--c-meta)',
          }}>
            Nothing to chart yet. Record a few entries and this fills in.
          </p>
        ) : (
          <div style={{ padding: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Card title="Six months">
              <MonthBars points={series} />
              <Table rows={series.map((p) => ({
                key: p.month,
                left: new Date(p.month).toLocaleDateString('en-IN', { month: 'long' }),
                right: Number(p.spent) === 0 ? '—' : format(Number(p.spent)),
                /* A month with nothing recorded is not a month you came in
                   under budget — you simply did not record anything, and saying
                   otherwise turns a gap in the data into a compliment. */
                note: p.entries === 0
                  ? 'nothing recorded'
                  : Number(p.budget) > 0
                    ? (Number(p.spent) > Number(p.budget)
                        ? `${format(Number(p.spent) - Number(p.budget))} over`
                        : `${format(Number(p.budget) - Number(p.spent))} under`)
                    : undefined,
                bad: p.entries > 0 && Number(p.budget) > 0 && Number(p.spent) > Number(p.budget),
              }))} />
            </Card>

            {slices.length > 0 && (
              <Card title="Where it went this month">
                <CategoryDonut slices={slices} total={sliceTotal} />
              </Card>
            )}

            {movers.length > 0 && (
              <Card title="Biggest changes on last month">
                <ul style={{
                  margin: 0, padding: 0, listStyle: 'none',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {movers.map((m, i) => (
                    <li key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 56,
                      borderBottom: i === movers.length - 1 ? undefined : '1px solid var(--c-rule)',
                    }}>
                      <Chip icon={m.icon} tint={m.tint} size={34} radius={9} iconSize={17} />
                      <Link transitionTypes={['nav-forward']} href={`/entries?c=${m.id}`} style={{
                        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
                        textDecoration: 'none', color: 'var(--c-ink)',
                      }}>
                        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                          {format(Number(m.before))} → {format(Number(m.now))}
                        </span>
                      </Link>
                      <span className="amt" style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--1)', fontWeight: 600,
                        color: m.delta > 0 ? 'var(--c-danger)' : 'var(--c-ok)',
                      }}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={m.delta > 0 ? 'M12 19V5M6 11l6-6 6 6' : 'M12 5v14M6 13l6 6 6-6'} />
                        </svg>
                        {format(Math.abs(m.delta))}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
        <TabBar current="/trends" />
      </main>
    </Screen>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
          {title}
        </h2>
        <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      </div>
      <div className="el card" style={{
        margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      }}>{children}</div>
    </section>
  );
}

function Table({ rows }: {
  rows: { key: string; left: string; right: string; note?: string; bad?: boolean }[];
}) {
  return (
    <ul style={{
      margin: '14px 0 0', padding: '14px 0 0', listStyle: 'none',
      borderTop: '1px solid var(--c-rule)', display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      {rows.map((r) => (
        <li key={r.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 'var(--step--1)' }}>
          <span style={{ flex: 1, color: 'var(--c-meta)' }}>{r.left}</span>
          {r.note && (
            <span style={{
              fontSize: 'var(--step--2)',
              color: r.bad ? 'var(--c-danger)'
                : r.note === 'nothing recorded' ? 'var(--c-meta)' : 'var(--c-ok)',
            }}>{r.note}</span>
          )}
          <span style={{ fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{r.right}</span>
        </li>
      ))}
    </ul>
  );
}
