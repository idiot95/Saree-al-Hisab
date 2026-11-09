import Link from '@/app/NavLink';
import { EmptyLine } from '../entries/parts';
import { Chip, Icon } from '../Icon';
import { tabTint } from '../tab/look';
import { format } from '@/lib/money';
import type { categoryTrend, monthlySeries, receiptsByMonth, tabList } from '@/db/queries';
import { LazyBackBars, LazySpendLine } from './LazyCharts';
import { liRule } from '../form-bits';

/* Trends, the bottom of Plan (#trends): where the month went, what moved against last month, six months of
   spending against the budget, what is owed to you by tab, and six months of money back.

   The running month is compared DAY FOR DAY: on the 6th, six days of it against the first six days of last
   month, never against all thirty. The average is of finished months only — a month two days old would drag it
   down. A category's colour stays on its icon; every bar is the primary, so no bar reads as a status. Red is for
   a month over its budget, and it carries the icon and the words. */

type Series = Awaited<ReturnType<typeof monthlySeries>>;
type Cats = Awaited<ReturnType<typeof categoryTrend>>;
type Tabs = Awaited<ReturnType<typeof tabList>>;
type Receipts = Awaited<ReturnType<typeof receiptsByMonth>>;

const long = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'long' });
const short = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short' });

export default function Trends({ month, partial, day, future, series, cats, tabs, receipts }: {
  /** The month Trends is about (?m=, never later than this one). */
  month: string; partial: boolean; day: number;
  /** Plan is showing a month that has not started: there is nothing to chart for it yet. */
  future: boolean;
  series: Series; cats: Cats; tabs: Tabs; receipts: Receipts;
}) {
  const owing = tabs
    .filter((t) => !t.closed_at && Number(t.outstanding) > 0)
    .sort((a, b) => Number(b.outstanding) - Number(a.outstanding));
  const owingMax = Math.max(1, ...owing.map((t) => Number(t.outstanding)));
  const owingTotal = owing.reduce((n, t) => n + Number(t.outstanding), 0);
  const cameBack = receipts.some((r) => Number(r.back) > 0);

  /* Months before anything was recorded are not months of nothing: they are left off the chart. */
  const firstData = series.findIndex((p) => p.entries > 0);
  const shown = firstData < 0 ? [] : series.slice(firstData);
  const finished = shown.filter((p) => !(partial && p.month.slice(0, 10) === month) && p.entries > 0);
  const average = finished.length
    ? Math.round(finished.reduce((n, p) => n + Number(p.spent), 0) / finished.length) : 0;

  const thisMonth = cats.reduce((n, c) => n + Number(c.now), 0);
  const lastMonth = cats.reduce((n, c) => n + Number(c.before), 0);
  const prevName = long(series[series.length - 2]?.month ?? month);
  const byThen = partial ? `by the ${ordinal(day)} of ${prevName}` : `in ${prevName}`;

  const slices = cats.filter((c) => Number(c.now) > 0)
    .map((c) => ({ id: c.id, name: c.name, icon: c.icon, tint: c.tint, amount: Number(c.now) }))
    .sort((a, b) => b.amount - a.amount);
  const sliceMax = Math.max(1, ...slices.map((s) => s.amount));

  const movers = cats
    .map((c) => ({ ...c, delta: Number(c.now) - Number(c.before) }))
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const nothing = future || (thisMonth === 0 && shown.length === 0 && owing.length === 0 && !cameBack);

  return (
    <section id="trends" aria-labelledby="trends-title" className="flex scroll-mt-4 flex-col gap-4">
      <div className="px-[var(--gutter)]">
        <h2 id="trends-title" className="px-0.5 text-subhead font-semibold text-muted-foreground">Trends</h2>
        {average > 0 && !future && (
          <p className="px-0.5 text-subhead text-muted-foreground">
            <span className="whitespace-nowrap">{format(average)} a month</span>{' '}
            <span className="whitespace-nowrap">on average</span>
          </p>
        )}
      </div>

      {nothing ? (
        <EmptyLine icon="trending_flat" className="mx-[var(--gutter)] rounded-[20px] bg-card shadow-card">
          {future ? `Trends start when ${long(month)} does.` : 'Nothing to chart yet. Record a few entries and this fills in.'}
        </EmptyLine>
      ) : (
        <>
          {lastMonth > 0 && thisMonth > 0 && (
            <p className="mx-[var(--gutter)] flex items-start gap-3 rounded-[20px] bg-card shadow-card px-4 py-3.5 text-body leading-snug">
              <Icon name={thisMonth > lastMonth ? 'trending_up' : thisMonth < lastMonth ? 'trending_down' : 'trending_flat'}
                size={20} className="mt-px text-primary" />
              <span>
                <span className="font-semibold tabular-nums">{format(thisMonth)}</span>{' '}
                <span className="text-muted-foreground">
                  {partial ? `so far in ${long(month)},` : `in ${long(month)},`}{' '}
                  {thisMonth === lastMonth ? `the same as ${byThen}`
                    : `${format(Math.abs(thisMonth - lastMonth))} ${thisMonth > lastMonth ? 'more' : 'less'} than ${byThen}`}
                </span>
              </span>
            </p>
          )}

          {slices.length > 0 && (
            <Card title={`Where it went in ${long(month)}${partial ? ` (to the ${ordinal(day)})` : ''}`}>
              <ul className="flex flex-col">
                {slices.map((s) => (
                  <li key={s.id}>
                    <Link href={`/entries?m=${month}&c=${s.id}`}
                      className="press flex min-h-14 items-center gap-3 py-2">
                      <Chip icon={s.icon} tint={s.tint} size={34} iconSize={18} />
                      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex items-baseline justify-between gap-2 text-body">
                          <span className="font-medium [overflow-wrap:anywhere]">{s.name}</span>
                          <span className="flex flex-none items-baseline gap-2">
                            <span className="text-footnote text-muted-foreground tabular-nums">{Math.round((s.amount / thisMonth) * 100)}%</span>
                            <span className="font-semibold tabular-nums">{format(s.amount)}</span>
                          </span>
                        </span>
                        <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${((s.amount / sliceMax) * 100).toFixed(1)}%` }} />
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {movers.length > 0 && (
            <Card title={partial ? `Changes on ${prevName}, day for day` : `Changes on ${prevName}`}>
              <ul className="flex flex-col">
                {movers.map((m) => (
                  <li key={m.id} className={`${liRule} [--rule-x:46px] [--rule-r:16px]`}>
                    <Link href={`/entries?m=${month}&c=${m.id}`}
                      className="press flex min-h-14 items-center gap-3 py-2">
                      <Chip icon={m.icon} tint={m.tint} size={34} iconSize={18} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-body font-medium [overflow-wrap:anywhere]">{m.name}</span>
                        <span className="text-footnote text-muted-foreground tabular-nums">
                          {format(Number(m.before))} → {format(Number(m.now))}
                        </span>
                      </span>
                      <span className="flex flex-none items-center gap-1 text-body font-semibold tabular-nums">
                        <Icon name={m.delta > 0 ? 'trending_up' : 'trending_down'} size={16} className="text-muted-foreground" />
                        {format(Math.abs(m.delta))} {m.delta > 0 ? 'more' : 'less'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {shown.length > 0 && (
            <Card title={shown.length > 1 ? `${shown.length} months` : 'This month'}>
              {shown.length > 1 && (
                <>
                  <LazySpendLine points={shown.map((p) => ({
                    label: short(p.month), spent: Number(p.spent), budget: Number(p.budget) > 0 ? Number(p.budget) : null,
                  }))} />
                  <p aria-hidden="true" className="mt-1.5 flex gap-4 text-footnote text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-primary" />Spent</span>
                    {shown.some((p) => Number(p.budget) > 0) && (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full border-[1.5px] border-muted-foreground" />Budget
                      </span>
                    )}
                  </p>
                </>
              )}
              <ul className={`flex flex-col gap-2.5 text-body ${shown.length > 1 ? 'mt-3 border-t border-border pt-3' : ''}`}>
                {shown.map((p) => {
                  const spent = Number(p.spent), budget = Number(p.budget);
                  const over = p.entries > 0 && budget > 0 && spent > budget;
                  return (
                    <li key={p.month} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="flex-1 text-muted-foreground">{long(p.month)}</span>
                      {/* A month with nothing recorded is not a month you came in under budget: you simply did not
                          record anything, and saying otherwise turns a gap in the data into a compliment. */}
                      {p.entries === 0 ? (
                        <span className="text-footnote text-muted-foreground">nothing recorded</span>
                      ) : over ? (
                        <span className="flex items-center gap-1 text-footnote font-semibold text-destructive">
                          <Icon name="warning" size={14} />Over budget by {format(spent - budget)}
                        </span>
                      ) : budget > 0 ? (
                        <span className="text-footnote text-muted-foreground tabular-nums">{format(budget - spent)} under budget</span>
                      ) : null}
                      <span className="min-w-[72px] text-right font-semibold tabular-nums">{spent === 0 ? '—' : format(spent)}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {owing.length > 0 && (
            <Card title="Owed to you, by tab">
              <ul className="flex flex-col gap-1">
                {owing.map((t) => {
                  const owed = Number(t.outstanding);
                  return (
                    <li key={t.id}>
                      <Link href={`/tab/${t.id}`} className="press flex min-h-14 flex-col justify-center gap-1.5 py-2">
                        <span className="flex items-center gap-2.5 text-body">
                          <Chip icon="folder" tint={tabTint(t.id)} size={28} iconSize={15} />
                          <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{t.name}</span>
                          <span className="font-semibold tabular-nums">{format(owed)}</span>
                        </span>
                        <span role="img" aria-label={`${t.name}: ${format(owed)} owed`} className="block h-2 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${((owed / owingMax) * 100).toFixed(1)}%` }} />
                        </span>
                        <span className="text-footnote text-muted-foreground">
                          {Number(t.back) > 0
                            ? `${format(Number(t.back))} of ${format(Number(t.owed_in_all))} back`
                            : 'None back yet'}
                          {t.members.length === 0 ? ' · no one named' : ''}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 flex items-baseline gap-3 border-t border-border pt-3 text-body">
                <span className="flex-1 text-muted-foreground">All open tabs</span>
                <span className="font-semibold tabular-nums">{format(owingTotal)}</span>
              </p>
            </Card>
          )}

          {cameBack && (
            <Card title="Came back, six months">
              <LazyBackBars points={receipts.map((r) => ({ label: short(r.month), back: Number(r.back) }))} />
              <ul className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3 text-body">
                {receipts.map((r) => (
                  <li key={r.month} className="flex items-baseline gap-3">
                    <span className="flex-1 text-muted-foreground">{long(r.month)}</span>
                    <span className="font-semibold tabular-nums">{Number(r.back) === 0 ? '—' : format(Number(r.back))}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mx-[var(--gutter)] flex flex-col gap-1.5">
      <h3 className="px-0.5 text-subhead font-semibold text-muted-foreground">{title}</h3>
      <div className="rounded-[20px] bg-card shadow-card px-4 py-3">{children}</div>
    </section>
  );
}

export function ordinal(n: number) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}
