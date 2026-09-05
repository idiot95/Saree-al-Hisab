import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull, budgetFor, monthTotals, previousBudget } from '@/db/queries';
import { format, monthKey } from '@/lib/money';
import { HEADER_BG } from '../auth-ui';
import TabBar, { TAB_BAR_SPACE } from '../TabBar';
import BudgetForm from './BudgetForm';
import CopyPrevious from './CopyPrevious';

export const metadata = { title: 'Budget · Quiet Ledger' };
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

  const [rows, totals, previous] = await Promise.all([
    budgetFor(actor.household_id, month),
    monthTotals(actor.household_id, month),
    previousBudget(actor.household_id, month),
  ]);

  const budget = Number(totals.budget);
  const spent = Number(totals.spent);
  const left = budget - spent;
  const canEdit = actor.role !== 'viewer';
  const empty = budget === 0;

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--c-bg)', paddingBottom: TAB_BAR_SPACE }}>
      <header className="el2" style={{
        background: HEADER_BG, color: '#fff', borderRadius: '0 0 28px 28px',
        padding: '18px 20px 26px', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/" aria-label="Back" style={{
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
          <span style={{ fontSize: 14.5, fontWeight: 600, minWidth: 118, textAlign: 'center' }}>
            {label(month)}
          </span>
          <Step href={`/budget?m=${shift(month, 1)}`} label="Next month" d="M9 5l7 7-7 7" />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
              BUDGETED
            </span>
            <span className="t" style={{ fontSize: 30, letterSpacing: '-.02em' }}>{format(budget)}</span>
          </span>
          {!empty && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 3 }}>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.66)', letterSpacing: '.04em' }}>
                {left >= 0 ? 'LEFT' : 'OVER'}
              </span>
              <span className="t" style={{
                fontSize: 21, letterSpacing: '-.02em',
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
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,.8)' }}>
          {empty
            ? 'Give each category an amount and everything reports against it.'
            : `${format(spent)} spent of ${format(budget)}`}
        </p>
      </header>

      <div style={{ padding: '14px 0 0' }}>
        {empty && previous && canEdit && (
          <CopyPrevious
            month={month}
            from={label(monthKey(new Date(previous.month)))}
            total={previous.total}
            categories={previous.categories}
          />
        )}

        <BudgetForm month={month} rows={rows} canEdit={canEdit} />

        {!canEdit && (
          <p style={{
            margin: '4px 20px 0', fontSize: 12.5, lineHeight: 1.5,
            color: 'var(--c-meta)', textAlign: 'center',
          }}>
            Only owners and contributing members can change the budget.
          </p>
        )}

        <p style={{
          margin: '18px 20px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          Each month is its own set of figures. Changing {label(month)} leaves every earlier
          month exactly as it was.
        </p>
      </div>
      <TabBar current="/budget" />
    </main>
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
