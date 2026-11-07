import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import {
  actorOrNull, budgetFor, budgetLinesFor, budgetSetsFor, categoriesFor, categoryTrend, monthTotals, monthlySeries,
  previousBudget, receiptsByMonth, tabList,
} from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format, monthKey } from '@/lib/money';
import { Progress } from '@/components/ui/progress';
import { Chip, Icon } from '../Icon';
import { Figure } from '../Figure';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import MonthPill from '../MonthPill';
import PageHead from '../PageHead';
import Screen from '../Screen';
import { paceOf } from '../home/LeftToSpend';
import BudgetForm from './BudgetForm';
import CopyPrevious from './CopyPrevious';
import Budgets from './Budgets';
import Trends from './Trends';

export const metadata = { title: 'Plan · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const label = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/* Plan: the budget and the trends on one pushed screen, opened from Home's month card.

   Top to bottom: the month's figures (?m=, what has gone and what is left), the budget lines by category, the
   budgets you keep, "Adjust this month only", and Trends (#trends; /trends redirects here). Everything is read in
   one transaction. */
export default async function Plan({ searchParams }: {
  searchParams: Promise<{ m?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m } = await searchParams;
  const now = new Date();
  const current = monthKey(now);
  const month = m && MONTH.test(m) ? m : current;
  /* Trends is about a month that has started: the one shown, or this one when a later month is being planned.
     The running month is compared day for day. */
  const future = month > current;
  const trendMonth = future ? current : month;
  const partial = trendMonth === current;
  const day = now.getDate();

  const hh = actor.household_id;
  const [rows, totals, previous, sets, cats, lines, series, trend, tabs, receipts] = await withHousehold(hh, () => Promise.all([
    budgetFor(hh, month),
    monthTotals(hh, month),
    previousBudget(hh, month),
    budgetSetsFor(hh),
    categoriesFor(hh),
    budgetLinesFor(hh),
    monthlySeries(hh, 6, trendMonth),
    categoryTrend(hh, trendMonth, partial ? day : null),
    tabList(hh),
    receiptsByMonth(hh, 6, trendMonth),
  ]));

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  const canEdit = actor.role !== 'viewer';
  const empty = budget === 0;
  /* Only the categories this month has something to say about: a line, or money against it. The full grid of
     every category is under "Adjust this month only". */
  const lit = rows.filter((r) => Number(r.budget) > 0 || Number(r.spent) > 0);
  const budgeted = rows.filter((r) => Number(r.budget) > 0).length;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <PageHead back="/" title="Plan" right={<MonthPill month={month} path="/budget" />}
          sub={empty ? 'Nothing budgeted yet' : `${budgeted} ${budgeted === 1 ? 'category' : 'categories'} budgeted`} />

        <div className="flex flex-col gap-5 pb-6">
          <div className="flex flex-col gap-4 px-[var(--gutter)]">
            <MonthFigures month={month} budget={budget} spent={spent} future={future} />

            {empty && previous && canEdit && (
              <CopyPrevious
                month={month}
                from={label(monthKey(new Date(previous.month)))}
                total={previous.total}
                categories={previous.categories}
              />
            )}

            {lit.length > 0 && (
              <section aria-label="By category" className="flex flex-col gap-1.5">
                <h2 className="px-0.5 text-subhead font-semibold text-muted-foreground">By category</h2>
                <ul className="overflow-hidden rounded-[18px] bg-card">
                  {lit.map((r) => <CategoryLine key={r.category_id} row={r} month={month} />)}
                </ul>
              </section>
            )}
          </div>

          {canEdit && (
            <Budgets
              budgets={sets.map((b) => ({ ...b }))}
              lines={lines.map((l) => ({ ...l }))}
              categories={cats.filter((c) => c.scope !== 'income')}
              thisMonth={month.slice(0, 7)}
              spentBy={Object.fromEntries(rows.map((r) => [r.category_id, r.spent]))}
            />
          )}

          {/* Two ways to change things, in one card: this month alone (the full grid, every category including the
              ones with nothing against them, without touching the budget behind it — a native <details>, so it opens
              with no JS), and the categories themselves. */}
          <div className="mx-[var(--gutter)] overflow-clip rounded-[18px] bg-card">
            {canEdit && sets.length > 0 && (
              <details className="group border-b border-border">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 text-body font-medium [&::-webkit-details-marker]:hidden">
                  <Icon name="tune" size={22} className="text-primary" />
                  <span className="flex-1">Adjust {label(month)} only</span>
                  <Icon name="expand_more" size={20} className="text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="pb-3">
                  <BudgetForm month={month} rows={rows} canEdit={canEdit} />
                  <p className="mx-4 mt-1 text-footnote leading-relaxed text-muted-foreground">
                    Each month is its own set of figures. Changing {label(month)} leaves every
                    earlier month exactly as it was, and leaves your budget untouched.
                  </p>
                </div>
              </details>
            )}
            <Link href="/categories"
              className="press flex min-h-14 items-center gap-3 px-4 text-body font-medium">
              <Icon name="sell" size={22} className="text-primary" />
              <span className="flex-1">Edit categories</span>
              <Icon name="chevron_right" size={18} className="text-muted-foreground" />
            </Link>
          </div>

          <Trends month={trendMonth} partial={partial} day={day} future={future}
            series={series} cats={trend} tabs={tabs} receipts={receipts} />
        </div>
        <TabBar current="/budget" />
      </main>
    </Screen>
  );
}

/* The month in one card: what is left (or how far over), what has gone of what was budgeted, and for the running
   month the pace tick and the day. The status is Home's (paceOf), so the two screens say the same about the same
   month. The figures are Figure: after "Adjust this month only" saves, they roll to the new values. */
function MonthFigures({ month, budget, spent, future }: { month: string; budget: number; spent: number; future: boolean }) {
  const name = new Date(month).toLocaleDateString('en-IN', { month: 'long' });
  if (budget === 0) {
    return (
      <section aria-label={`${label(month)} so far`} className="flex flex-col gap-2 rounded-[22px] bg-card p-[18px]">
        <span className="text-subhead text-muted-foreground">Spent in {name}</span>
        <Figure minor={spent} className="text-large-title font-bold leading-none tracking-tight tabular-nums" />
        <span className="text-footnote text-muted-foreground">Nothing budgeted for {name} yet.</span>
      </section>
    );
  }
  const pace = paceOf(month, budget, spent);
  const status = pace.sameMonth || pace.over ? pace.status
    : future ? { word: 'Not started', icon: 'schedule', tone: 'text-muted-foreground' }
      : { word: 'Within budget', icon: 'check_circle', tone: 'text-money-in' };
  return (
    <section aria-label={`${label(month)} against the budget`} className="flex flex-col gap-3 rounded-[22px] bg-card p-[18px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-subhead text-muted-foreground">{pace.over ? 'Over budget by' : 'Left to spend'}</span>
        <span className={`flex items-center gap-1 text-footnote font-semibold ${status.tone}`}>
          <Icon name={status.icon} size={16} />{status.word}
        </span>
      </div>
      <Figure minor={Math.abs(budget - spent)} className="text-large-title font-bold leading-none tracking-tight tabular-nums" />
      <div className="relative py-[3px]">
        <Progress value={Math.min(100, pace.throughMoney * 100)}
          aria-label={`${Math.round(pace.throughMoney * 100)}% of the budget spent`}
          className={`h-2.5 bg-muted *:data-[slot=progress-indicator]:rounded-full ${pace.fill}`} />
        {pace.sameMonth && (
          <span aria-hidden="true" className={`absolute top-0 h-4 w-0.5 -translate-x-1/2 rounded-full ${pace.over ? 'bg-card' : 'bg-foreground'}`}
            style={{ left: `${pace.throughMonth * 100}%` }} />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-footnote text-muted-foreground">
        <span className="min-w-0"><Figure minor={spent} /> spent of <Figure minor={budget} /></span>
        {pace.sameMonth && <span className="flex-none">Day {pace.day} of {pace.days}</span>}
      </div>
    </section>
  );
}

type Row = Awaited<ReturnType<typeof budgetFor>>[number];

/* One category's month. The bar is the primary, red only once it is over (with an icon and the words): a
   category's own colour on a bar read as a status. The colour stays on the icon. The row opens that category's
   entries; the "of which" children open their own. */
function CategoryLine({ row, month }: { row: Row; month: string }) {
  const cap = Number(row.budget);
  const used = Number(row.spent);
  const over = cap > 0 && used > cap;
  const kids = (row.kids as { id: string; name: string; spent: string }[]).filter((k) => Number(k.spent) > 0);
  return (
    <li className="border-b border-border last:border-b-0">
      <Link href={`/entries?m=${month}&c=${row.category_id}`}
        className="press flex min-h-[68px] items-center gap-3 px-3.5 py-3">
        <Chip icon={row.icon} tint={row.tint} size={36} radius={10} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 text-body font-medium [overflow-wrap:anywhere]">
              {row.name}
              {row.archived && (
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 align-middle text-caption font-bold tracking-wide text-muted-foreground">RETIRED</span>
              )}
            </span>
            <span className={`flex flex-none items-center gap-1 text-body font-semibold tabular-nums ${over ? 'text-destructive' : ''}`}>
              {over && <Icon name="warning" size={14} />}
              {cap === 0 ? format(used) : over ? `${format(used - cap)} over` : `${format(cap - used)} left`}
            </span>
          </span>
          {cap > 0 && (
            <span role="img" aria-label={`${row.name}: ${format(used)} of ${format(cap)}${over ? ', over budget' : ''}`}
              className="block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className={`block h-full rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
            </span>
          )}
          <span className="text-footnote text-muted-foreground tabular-nums">
            {cap === 0 ? 'spent · not budgeted' : over ? `Over budget · ${format(used)} of ${format(cap)}` : `${format(used)} of ${format(cap)}`}
          </span>
        </span>
      </Link>
      {kids.length > 0 && (
        <p className="-mt-1.5 flex flex-wrap gap-x-1 pb-3 pl-[62px] pr-4 text-footnote leading-relaxed text-muted-foreground">
          <span>of which</span>
          {kids.map((k, j) => (
            <Link key={k.id} href={`/entries?m=${month}&c=${k.id}`} className="font-semibold">
              {k.name} {format(Number(k.spent))}{j < kids.length - 1 ? ' ·' : ''}
            </Link>
          ))}
        </p>
      )}
    </li>
  );
}
