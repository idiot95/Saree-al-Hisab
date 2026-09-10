import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  actorOrNull, budgetFor, budgetLinesFor, budgetSetsFor, categoriesFor, monthTotals, previousBudget,
} from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { headerBg } from '../auth-ui';
import TabBar from '../TabBar';
import { TAB_BAR_SPACE } from '../tabs';
import BudgetForm from './BudgetForm';
import CopyPrevious from './CopyPrevious';
import Budgets from './Budgets';
import Screen from '../Screen';
import Back from '../Back';

export const metadata = { title: 'Budget · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

const MONTH = /^\d{4}-\d{2}-01$/;
const label = (m: string) =>
  new Date(m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shift = (m: string, by: number) => {
  const d = new Date(m);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

export default async function Budget({ searchParams }: {
  searchParams: Promise<{ m?: string }>;
}) {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (!actor.household_id) redirect('/no-household');

  const { m } = await searchParams;
  const month = m && MONTH.test(m) ? m : monthKey(new Date());

  const [rows, totals, previous, sets, cats, lines] = await Promise.all([
    budgetFor(actor.household_id, month),
    monthTotals(actor.household_id, month),
    previousBudget(actor.household_id, month),
    budgetSetsFor(actor.household_id),
    categoriesFor(actor.household_id),
    budgetLinesFor(actor.household_id),
  ]);

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  const left = budget - spent;
  const canEdit = actor.role !== 'viewer';
  const empty = budget === 0;

  return (
    <Screen>
      <Back to="/" />
      <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
        <header className="el2" style={{
          background: headerBg('gold'), color: '#fff', borderRadius: '0 0 28px 28px',
          padding: '18px var(--gutter) 26px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link href="/" transitionTypes={['nav-back']} aria-label="Back" style={{
              width: 44, height: 44, marginLeft: -11, borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)',
            }}>
              <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </Link>
            <span style={{ flex: 1 }} />
            <Step href={`/budget?m=${shift(month, -1)}`} label="Previous month" d="M15 5l-7 7 7 7" />
            <h1 style={{
              margin: 0, fontSize: 'var(--step-1)', fontWeight: 650, minWidth: 122, textAlign: 'center',
            }}>{label(month)}</h1>
            <Step href={`/budget?m=${shift(month, 1)}`} label="Next month" d="M9 5l7 7-7 7" />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                BUDGETED
              </span>
              <span className="t" style={{ fontSize: 'var(--step-4)', letterSpacing: '-.02em' }}>{format(budget)}</span>
            </span>
            {!empty && (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 3 }}>
                <span style={{ fontSize: 'var(--step--2)', color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                  {left >= 0 ? 'LEFT' : 'OVER'}
                </span>
                <span className="t" style={{
                  fontSize: 'var(--step-2)', letterSpacing: '-.02em',
                  color: left >= 0 ? '#fff' : 'var(--c-danger-fill)',
                }}>{format(Math.abs(left))}</span>
              </span>
            )}
          </div>

          {!empty && (
            <span style={{
              height: 8, borderRadius: 999, background: 'rgba(255,255,255,.18)', overflow: 'hidden',
            }}>
              <span style={{
                display: 'block', height: '100%', borderRadius: 999,
                width: `${Math.min(100, (spent / budget) * 100)}%`,
                background: spent > budget ? 'var(--c-danger-fill)'
                  : spent / budget > 0.85 ? 'var(--c-warn-fill)' : 'var(--c-ok-fill)',
              }} />
            </span>
          )}
          <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'rgba(255,255,255,.8)' }}>
            {empty
              ? 'Give each category an amount and everything reports against it.'
              : `${format(spent)} spent of ${format(budget)}`}
          </p>
        </header>

        <div style={{ padding: '14px 0 0' }}>
          <Link transitionTypes={['nav-forward']} href="/categories" style={{
            display: 'flex', alignItems: 'center', gap: 10, margin: '0 var(--gutter) 14px',
            minHeight: 50, padding: '0 var(--gutter)', borderRadius: 14, textDecoration: 'none',
            background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-ink)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--c-meta)"
              strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3.5 11V4.5H10L20.5 15a1.6 1.6 0 0 1 0 2.3l-3.2 3.2a1.6 1.6 0 0 1-2.3 0z" />
              <path d="M7 8v.01" />
            </svg>
            <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 600 }}>Edit categories</span>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="var(--c-off)"
              strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </Link>
          {empty && previous && canEdit && (
            <CopyPrevious
              month={month}
              from={label(monthKey(new Date(previous.month)))}
              total={previous.total}
              categories={previous.categories}
            />
          )}

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
          {canEdit && sets.length > 0 && (
            <details style={{ margin: '22px var(--gutter) 0' }}>
              <summary style={{
                minHeight: 48, display: 'flex', alignItems: 'center', padding: '0 var(--pad)',
                borderRadius: 14, background: 'var(--c-card)', border: '1px solid var(--c-border)',
                fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-ink)', cursor: 'pointer',
              }}>
                Adjust {label(month)} only
              </summary>
              <div style={{ margin: '10px calc(var(--gutter) * -1) 0' }}>
                <BudgetForm month={month} rows={rows} canEdit={canEdit} />
                <p style={{
                  margin: '14px var(--gutter) 0', fontSize: 'var(--step--1)',
                  lineHeight: 1.5, color: 'var(--c-meta)',
                }}>
                  Each month is its own set of figures. Changing {label(month)} leaves every
                  earlier month exactly as it was — and leaves the budget above untouched.
                </p>
              </div>
            </details>
          )}
        </div>
        <TabBar current="/budget" />
      </main>
    </Screen>
  );
}

function Step({ href, label, d }: { href: string; label: string; d: string }) {
  return (
    <Link href={href} aria-label={label} style={{
      width: 44, height: 44, borderRadius: 999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: 'rgba(255,255,255,.9)',
    }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={d} />
      </svg>
    </Link>
  );
}
