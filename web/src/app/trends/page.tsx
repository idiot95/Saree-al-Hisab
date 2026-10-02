import Link from '@/app/NavLink';
import { Chip } from '../Icon';
import { redirect } from 'next/navigation';
import { actorOrNull, categoryTrend, monthlySeries, receiptsByMonth, tabList } from '@/db/queries';
import { withHousehold } from '@/db/client';
import { tabTint } from '../tab/look';
import { format, monthKey } from '@/lib/money';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import { MonthBars, CategoryDonut } from './charts';
import Screen from '../Screen';
import PlanNav from '../budget/PlanNav';

export const metadata = { title: 'Trends · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Trends() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const month = monthKey(new Date());
  const hh = actor.household_id;
  const [series, cats, tabs, receipts] = await withHousehold(hh, () => Promise.all([
    monthlySeries(hh, 6),
    categoryTrend(hh, month),
    tabList(hh),
    receiptsByMonth(hh, 6),
  ]));

  /* What is owed, by TAB and never by person: a tab is how the household
     thinks of the money ("the Dubai trip"), and a tab with nobody named on it
     has no person to chart at all. Longest bar first, each in its tab's own
     colour, the figure written beside it. */
  const owing = tabs
    .filter((t) => !t.closed_at && Number(t.outstanding) > 0)
    .sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
  const owingMax = Math.max(1, ...owing.map((t) => Number(t.outstanding)));
  const owingTotal = owing.reduce((n, t) => n + Number(t.outstanding), 0);
  const cameBack = receipts.some((r) => Number(r.back) > 0);

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

  const nothing = sliceTotal === 0 && withSpend.length === 0 && owing.length === 0 && !cameBack;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <header className="flex flex-col gap-3 px-[var(--gutter)] pb-4 pt-4">
          <div className="min-w-0">
            <h1 className="font-display text-[30px] leading-tight">Plan</h1>
            {!nothing && average > 0 && (
              <p className="text-sm text-muted-foreground">
                <span className="whitespace-nowrap">{format(average)} a month on average</span>
                {lastMonth > 0 && thisMonth > 0 && (
                  <>{' · '}<span className="whitespace-nowrap">{thisMonth > lastMonth
                    ? `${format(thisMonth - lastMonth)} more than last month`
                    : `${format(lastMonth - thisMonth)} less than last month`}</span></>
                )}
              </p>
            )}
          </div>
          <PlanNav current="trends" />
        </header>

        {nothing ? (
          <p style={{
            margin: '40px 34px', textAlign: 'center', fontSize: 'var(--step-0)', lineHeight: 1.55,
            color: 'var(--muted-foreground)',
          }}>
            Nothing to chart yet. Record a few entries and this fills in.
          </p>
        ) : (
          <div style={{ padding: '4px 0 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
                      borderBottom: i === movers.length - 1 ? undefined : '1px solid var(--border)',
                    }}>
                      <Chip icon={m.icon} tint={m.tint} size={34} radius={9} iconSize={17} />
                      <Link transitionTypes={['nav-forward']} href={`/entries?c=${m.id}`} style={{
                        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2,
                        textDecoration: 'none', color: 'var(--foreground)',
                      }}>
                        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{m.name}</span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                          {format(Number(m.before))} → {format(Number(m.now))}
                        </span>
                      </Link>
                      <span className="amt" style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--1)', fontWeight: 600,
                        color: m.delta > 0 ? 'var(--money-out)' : 'var(--money-in)',
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

            {owing.length > 0 && (
              <Card title="Owed to you, by tab">
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {owing.map((t) => {
                    const owed = Number(t.outstanding);
                    const tint = tabTint(t.id);
                    return (
                      <li key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <Link transitionTypes={['nav-forward']} href={`/tab/${t.id}`} style={{
                          display: 'flex', alignItems: 'center', gap: 8, minHeight: 28,
                          textDecoration: 'none', color: 'var(--foreground)', fontSize: 'var(--step--1)',
                        }}>
                          <Chip icon="folder" tint={tint} size={22} radius={6} iconSize={12} />
                          <span style={{
                            flex: 1, minWidth: 0, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{t.name}</span>
                          <span style={{ fontWeight: 600, minWidth: 62, textAlign: 'right' }}>{format(owed)}</span>
                        </Link>
                        <span role="img" aria-label={`${t.name}: ${format(owed)} owed`} style={{
                          display: 'block', height: 10, borderRadius: 4, background: 'var(--muted)', overflow: 'hidden',
                        }}>
                          <span style={{
                            display: 'block', height: 10, borderRadius: '0 4px 4px 0',
                            width: `${((owed / owingMax) * 100).toFixed(1)}%`, background: `var(--cat-${tint}-ink)`,
                          }} />
                        </span>
                        <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                          {Number(t.back) > 0
                            ? `${format(Number(t.back))} of ${format(Number(t.owed_in_all))} back`
                            : 'none back yet'}
                          {t.members.length === 0 ? ' · no one named' : ''}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <div style={{
                  display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 14, paddingTop: 12,
                  borderTop: '1px solid var(--border)', fontSize: 'var(--step--1)',
                }}>
                  <span style={{ flex: 1, color: 'var(--muted-foreground)' }}>All open tabs</span>
                  <span style={{ fontWeight: 600 }}>{format(owingTotal)}</span>
                </div>
              </Card>
            )}

            {cameBack && (
              <Card title="Came back, six months">
                <BackBars points={receipts} />
                <Table rows={receipts.map((r) => ({
                  key: r.month,
                  left: new Date(r.month).toLocaleDateString('en-IN', { month: 'long' }),
                  right: Number(r.back) === 0 ? '—' : format(Number(r.back)),
                }))} />
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
    <section className="flex flex-col gap-2 px-[var(--gutter)]">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="rounded-2xl border border-border bg-card p-4">{children}</div>
    </section>
  );
}

/* Money that came back, a bar a month. One series and one axis; this month is
   the lit bar and the rest recede. The table under it carries the figures. */
function BackBars({ points }: { points: { month: string; back: string }[] }) {
  const max = Math.max(1, ...points.map((p) => Number(p.back)));
  return (
    <div role="img" aria-label={`Money back over ${points.length} months. `
      + points.map((p) => `${new Date(p.month).toLocaleDateString('en-IN', { month: 'short' })} ${format(Number(p.back))}`).join(', ')}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 110, padding: '0 4px' }}>
      {points.map((p, i) => {
        const v = Number(p.back);
        return (
          <span key={p.month} style={{
            flex: 1, height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-end', gap: 6,
          }}>
            <span style={{
              width: '100%', height: v ? Math.max(4, Math.round((v / max) * 80)) : 0, borderRadius: '4px 4px 0 0',
              background: i === points.length - 1 ? 'var(--chart-1)' : 'var(--input)',
            }} />
            <span style={{ fontSize: 9.5, color: 'var(--muted-foreground)' }}>
              {new Date(p.month).toLocaleDateString('en-IN', { month: 'short' })}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Table({ rows }: {
  rows: { key: string; left: string; right: string; note?: string; bad?: boolean }[];
}) {
  return (
    <ul style={{
      margin: '14px 0 0', padding: '14px 0 0', listStyle: 'none',
      borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9,
    }}>
      {rows.map((r) => (
        <li key={r.key} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 'var(--step--1)' }}>
          <span style={{ flex: 1, color: 'var(--muted-foreground)' }}>{r.left}</span>
          {r.note && (
            <span style={{
              fontSize: 'var(--step--2)',
              color: r.bad ? 'var(--destructive)'
                : r.note === 'nothing recorded' ? 'var(--muted-foreground)' : 'var(--money-in)',
            }}>{r.note}</span>
          )}
          <span style={{ fontWeight: 600, minWidth: 70, textAlign: 'right' }}>{r.right}</span>
        </li>
      ))}
    </ul>
  );
}
