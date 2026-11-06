import Link from '@/app/NavLink';
import { redirect } from 'next/navigation';
import {
  actorOrNull, budgetFor, budgetLinesFor, budgetSetsFor, categoriesFor, monthTotals, previousBudget,
} from '@/db/queries';
import { withHousehold } from '@/db/client';
import { format, monthKey } from '@/lib/money';
import { Chip } from '../Icon';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import MonthPill from '../MonthPill';
import BudgetForm from './BudgetForm';
import CopyPrevious from './CopyPrevious';
import Budgets from './Budgets';
import PlanNav from './PlanNav';
import Screen from '../Screen';
import { Icon } from '../Icon';

export const metadata = { title: 'Budget · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const label = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default async function Budget({ searchParams }: {
  searchParams: Promise<{ m?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(new Date());

  const hh = actor.household_id;
  const [rows, totals, previous, sets, cats, lines] = await withHousehold(hh, () => Promise.all([
    budgetFor(hh, month),
    monthTotals(hh, month),
    previousBudget(hh, month),
    budgetSetsFor(hh),
    categoriesFor(hh),
    budgetLinesFor(hh),
  ]));

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  const left = budget - spent;
  const canEdit = actor.role !== 'viewer';
  const empty = budget === 0;
  /* Only the headings this month has something to say about: a line, or money against it. The full grid of every
     heading is still under "Adjust this month only". */
  const lit = rows.filter((r) => Number(r.budget) > 0 || Number(r.spent) > 0);
  const headings = rows.filter((r) => Number(r.budget) > 0).length;
  const now = new Date();
  const start = new Date(month);
  const daysLeft = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth()
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() : null;

  return (
    <Screen>
      <main className="min-h-dvh bg-background text-foreground" style={{ paddingBottom: TAB_BAR_SPACE }}>
        <header className="flex flex-col gap-3 px-[var(--gutter)] pb-4 pt-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-[30px] leading-tight">Plan</h1>
              <p className="text-sm text-muted-foreground">
                {empty ? 'Nothing budgeted yet' : (
                  <>
                    <span className="whitespace-nowrap">{headings} {headings === 1 ? 'category' : 'categories'}</span>
                    {daysLeft !== null && <>{' · '}<span className="whitespace-nowrap">{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</span></>}
                  </>
                )}
              </p>
            </div>
            <MonthPill month={month} path="/budget" />
          </div>
          <PlanNav current="budget" />
        </header>

        <div className="flex flex-col gap-5 px-[var(--gutter)]">
          {!empty && (
            <section aria-label={`${label(month)} against the budget`} className="rounded-[22px] border border-border bg-card p-4">
              <dl className="grid grid-cols-3 gap-2">
                <Figure term="Budgeted" value={format(budget)} />
                <Figure term="Spent" value={format(spent)} />
                <Figure term={left >= 0 ? 'Left' : 'Over by'} value={format(Math.abs(left))}
                  tone={left < 0 ? 'var(--destructive)' : undefined} />
              </dl>
              <Bar share={spent / budget} colour={spent > budget ? 'var(--destructive)' : 'var(--primary)'}
                label={`${Math.round((spent / budget) * 100)}% of the budget spent`} className="mt-3.5 h-2" />
              {left < 0 && (
                <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                  <Icon name="warning" size={16} /> Over the budget for {label(month)}.
                </p>
              )}
            </section>
          )}

          {empty && previous && canEdit && (
            <CopyPrevious
              month={month}
              from={label(monthKey(new Date(previous.month)))}
              total={previous.total}
              categories={previous.categories}
            />
          )}

          {lit.length > 0 && (
            <section aria-label="By category" className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">By category</h2>
              <ul className="overflow-hidden rounded-2xl border border-border bg-card">
                {lit.map((r, i) => <CategoryLine key={r.category_id} row={r} month={month} first={i === 0} />)}
              </ul>
            </section>
          )}
        </div>

        <div className="mt-6 flex flex-col">
          {canEdit && (
            <Budgets
              budgets={sets.map((b) => ({ ...b }))}
              lines={lines.map((l) => ({ ...l }))}
              categories={cats.filter((c) => c.scope !== 'income')}
              thisMonth={month.slice(0, 7)}
              spentBy={Object.fromEntries(rows.map((r) => [r.category_id, r.spent]))}
            />
          )}

          {/* The full grid, every heading including the ones with nothing
              against them, is still the way to change a single month without
              touching the budget behind it. Shut by default: it was the first
              thing on the screen and it asked forty questions to answer two.
              <details> rather than state, so it works with no JS. */}
          {/* Two ways to change things, in one list: this month alone (the full grid, every category including the
              ones with nothing against them, without touching the budget behind it — a native <details>, so it works
              with no JS), and the categories themselves. */}
          <div className="mx-[var(--gutter)] mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            {canEdit && sets.length > 0 && (
              <details className="border-b border-border">
                <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-4 text-sm font-semibold">
                  <Icon name="tune" size={17} className="text-muted-foreground" />
                  <span className="flex-1">Adjust {label(month)} only</span>
                  <Icon name="expand_more" size={17} className="text-muted-foreground" />
                </summary>
                <div className="pb-3">
                  <BudgetForm month={month} rows={rows} canEdit={canEdit} />
                  <p className="mx-4 mt-1 text-xs leading-relaxed text-muted-foreground">
                    Each month is its own set of figures. Changing {label(month)} leaves every
                    earlier month exactly as it was, and leaves your budget untouched.
                  </p>
                </div>
              </details>
            )}
            <Link transitionTypes={['nav-forward']} href="/categories"
              className="flex min-h-12 items-center gap-2.5 px-4 text-sm font-semibold">
              <Icon name="sell" size={17} className="text-muted-foreground" />
              <span className="flex-1">Edit categories</span>
              <Icon name="chevron_right" size={17} className="text-muted-foreground" />
            </Link>
          </div>
        </div>
        <TabBar current="/budget" />
      </main>
    </Screen>
  );
}

function Figure({ term, value, tone }: { term: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="truncate font-display text-[24px] leading-tight tabular-nums" style={tone ? { color: tone } : undefined}>{value}</dd>
    </div>
  );
}

function Bar({ share, colour, label, className = '' }: { share: number; colour: string; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} className={`block overflow-hidden rounded-full bg-muted ${className}`}>
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, share * 100))}%`, background: colour }} />
    </span>
  );
}

type Row = Awaited<ReturnType<typeof budgetFor>>[number];

/* One category's month. The bar is navy, red only once it is over (with an icon and the word): a category's own
   colour on a bar read as a status — orange at 84% looked like a warning. The colour stays on the chip. The row opens that heading's entries; the "of which" children open their own. */
function CategoryLine({ row, month, first }: { row: Row; month: string; first: boolean }) {
  const cap = Number(row.budget);
  const used = Number(row.spent);
  const over = cap > 0 && used > cap;
  const kids = (row.kids as { id: string; name: string; spent: string }[]).filter((k) => Number(k.spent) > 0);
  return (
    <li className={first ? '' : 'border-t border-border'}>
      <Link transitionTypes={['nav-forward']} href={`/entries?m=${month}&c=${row.category_id}`}
        className="flex min-h-[68px] items-center gap-3 px-4 py-3">
        <Chip icon={row.icon} tint={row.tint} size={36} radius={10} />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-semibold">
              {row.name}
              {row.archived && (
                <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wide text-muted-foreground">RETIRED</span>
              )}
            </span>
            <span className={`flex flex-none items-center gap-1 text-sm font-semibold tabular-nums ${over ? 'text-destructive' : ''}`}>
              {over && <Icon name="warning" size={14} />}
              {cap === 0 ? format(used) : over ? `${format(used - cap)} over` : `${format(cap - used)} left`}
            </span>
          </span>
          {cap > 0 && (
            <Bar share={used / cap} colour={over ? 'var(--destructive)' : 'var(--primary)'}
              label={`${row.name}: ${format(used)} of ${format(cap)}`} className="h-1.5" />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {cap === 0 ? 'spent · not budgeted' : `${format(used)} of ${format(cap)}`}
          </span>
        </span>
      </Link>
      {kids.length > 0 && (
        <p className="-mt-1.5 flex flex-wrap gap-x-1 pb-3 pl-[64px] pr-4 text-xs leading-relaxed text-muted-foreground">
          <span>of which</span>
          {kids.map((k, j) => (
            <Link key={k.id} transitionTypes={['nav-forward']} href={`/entries?m=${month}&c=${k.id}`} className="font-semibold">
              {k.name} {format(Number(k.spent))}{j < kids.length - 1 ? ' ·' : ''}
            </Link>
          ))}
        </p>
      )}
    </li>
  );
}
