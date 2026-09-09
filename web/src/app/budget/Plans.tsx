'use client';

import { useActionState, useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { ErrorNote } from '../auth-ui';
import { useMoney } from '@/app/currency';
import { saveBudgetPlan, dropBudgetPlan } from './actions';
import type { Category } from '../CategoryFinder';

/* A budget that runs until a date instead of being retyped every month.

   The monthly rows stay what the app reads — a budget is spent against a
   month, and that is not a thing to rewrite — so a plan writes them and
   remains the record of why they say what they say. Saying "₹8,000 for
   Groceries, April to March" fills in the twelve months; changing it to
   ₹9,000 rewrites them; removing it takes them away again. That is the whole
   model, and it is stated on the screen rather than left to be inferred. */

export type Plan = {
  id: string; amount: string; category_id: string;
  from_month: string; to_month: string; name: string; icon: string; tint: string;
};

const monthName = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};
const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Plans({ plans, categories, thisMonth }: {
  plans: Plan[]; categories: Category[]; thisMonth: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const { format } = useMoney();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{
        margin: '0 var(--gutter)', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)',
      }}>
        A plan sets one category&rsquo;s budget for every month between two dates, so it stays
        put instead of being retyped. Change it and those months change with it.
      </p>

      {plans.length > 0 && (
        <div className="el card" style={{
          margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18,
          padding: '0 var(--pad)', overflow: 'hidden',
        }}>
          {plans.map((p, i) => (
            <div key={p.id} style={{ borderBottom: i === plans.length - 1 ? undefined : '1px solid var(--c-rule)' }}>
              <button type="button" onClick={() => { haptic('select'); setOpen(open === p.id ? null : p.id); }}
                aria-expanded={open === p.id}
                style={{
                  width: '100%', minHeight: 72, display: 'flex', alignItems: 'center', gap: 12,
                  textAlign: 'left', color: 'var(--c-ink)',
                }}>
                <Chip icon={p.icon} tint={p.tint} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{p.name}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    {monthName(p.from_month)} — {monthName(p.to_month)}
                  </span>
                </span>
                <span className="t n" style={{ fontSize: 'var(--step-0)' }}>
                  {format(Number(p.amount))}
                </span>
              </button>
              {open === p.id && (
                <PlanForm categories={categories} plan={p} thisMonth={thisMonth}
                  onDone={() => setOpen(null)} />
              )}
            </div>
          ))}
        </div>
      )}

      {open === 'new'
        ? (
          <div className="el card" style={{
            margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 'var(--pad)',
          }}>
            <PlanForm categories={categories} plan={null} thisMonth={thisMonth}
              onDone={() => setOpen(null)} />
          </div>
        )
        : (
          <button type="button" onClick={() => { haptic('select'); setOpen('new'); }} className="el card"
            style={{
              margin: '0 var(--gutter)', minHeight: 56, borderRadius: 16, display: 'flex',
              alignItems: 'center', gap: 11, padding: '0 var(--pad)', background: 'var(--c-card)',
              border: '1px dashed var(--c-dash)', color: 'var(--c-ink)',
              fontSize: 'var(--step-0)', fontWeight: 600,
            }}>
            <span style={{
              width: 32, height: 32, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.2} strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
            </span>
            Budget a category until a date
          </button>
        )}
    </section>
  );
}

function PlanForm({ categories, plan, thisMonth, onDone }: {
  categories: Category[]; plan: Plan | null; thisMonth: string; onDone: () => void;
}) {
  const [state, act, pending] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = await saveBudgetPlan(prev as null, fd);
    if (r.ok) { haptic('success'); onDone(); } else haptic('warn');
    return r;
  }, null);
  const [dropState, drop, dropping] = useActionState(dropBudgetPlan, null);
  const [categoryId, setCategoryId] = useState(plan?.category_id ?? '');
  const [from, setFrom] = useState(plan?.from_month ?? thisMonth);
  const [to, setTo] = useState(plan?.to_month ?? addMonths(thisMonth, 11));

  // A plan is per category, so a category that already has one is not offered
  // again — editing it is what the row above does.
  const spendable = categories.filter((c) => c.scope !== 'income');

  return (
    <div style={{ padding: plan ? '4px 0 16px' : 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
      <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        <input type="hidden" name="categoryId" value={categoryId} />
        {!plan && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Category</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required
              style={{
                minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
                border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
              }}>
              <option value="">Choose a category</option>
              {spendable.map((c) => (
                <option key={c.id} value={c.id}>{c.parent ? `${c.parent} › ` : ''}{c.name}</option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
            Every month
          </span>
          <input name="amount" inputMode="decimal" required defaultValue={plan ? String(Number(plan.amount) / 100) : ''}
            placeholder="8000" style={{
              minHeight: 50, borderRadius: 13, padding: '0 14px', fontSize: 'var(--field)',
              border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
            }} />
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>From</span>
            <input type="month" name="from" value={from} onChange={(e) => setFrom(e.target.value)} required
              style={{
                minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
                border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
              }} />
          </label>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Until</span>
            <input type="month" name="to" value={to} onChange={(e) => setTo(e.target.value)} required
              min={from} style={{
                minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
                border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
              }} />
          </label>
        </div>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        <div style={{ display: 'flex', gap: 9 }}>
          <button className="cta" type="button" onClick={onDone} style={{
            minHeight: 50, padding: '0 16px', borderRadius: 13, fontSize: 'var(--step-0)',
            fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>Cancel</button>
          <button className="cta" type="submit" disabled={pending} style={{
            flex: 1, minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
            background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
          }}>{pending ? 'Saving…' : plan ? 'Save plan' : 'Set the budget'}</button>
        </div>
      </form>

      {plan && (
        <form action={drop} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input type="hidden" name="id" value={plan.id} />
          <button className="cta" type="submit" disabled={dropping} style={{
            minHeight: 44, borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
            background: 'transparent', color: 'var(--c-danger)',
          }}>{dropping ? 'Removing…' : 'Remove this plan'}</button>
          {dropState && !dropState.ok && <ErrorNote>{dropState.error}</ErrorNote>}
          <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            The months it filled in go with it. Entries already recorded are untouched.
          </span>
        </form>
      )}
      {!plan && (
        <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
          <Icon name="info" size={13} strokeWidth={2} /> Each category has one plan. Setting a plan
          overwrites whatever those months already had.
        </p>
      )}
    </div>
  );
}
