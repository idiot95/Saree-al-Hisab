'use client';

import { useActionState, useState } from 'react';
import { Icon, Chip } from '../Icon';
import { haptic } from '../haptics';
import { ErrorNote } from '../auth-ui';
import { useMoney } from '@/app/currency';
import { createBudget } from './actions';
import type { Category } from '../CategoryFinder';

/* Setting the first budget, as two questions instead of a form.

   It used to be a grid of every heading with a zero in each, which asks a
   household to answer forty questions to answer two: what do you want to
   watch, and how much. So: pick the headings, then put a figure against the
   ones you picked. Only top-level categories are offered — nobody budgets
   "Milk & dairy", they budget Groceries, and the month rolls up the children
   anyway.

   The date is asked once, at the end, because it is one answer for the whole
   budget rather than one per category. */
export default function CreateBudget({ categories, thisMonth, defaultEnd }: {
  categories: Category[]; thisMonth: string; defaultEnd: string;
}) {
  const [state, act, pending] = useActionState(createBudget, null);
  const [step, setStep] = useState<1 | 2>(1);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const { format } = useMoney();

  const tops = categories.filter((c) => !c.parent_id);
  const chosen = tops.filter((c) => picked.has(c.id));
  const total = chosen.reduce((n, c) => n + Math.round(Number(amounts[c.id] || 0) * 100), 0);
  const filled = chosen.filter((c) => Number(amounts[c.id] || 0) > 0).length;

  const toggle = (id: string) => {
    haptic('select');
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <form action={act} className="el card" style={{
      margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18,
      padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{
          fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.06em',
          textTransform: 'uppercase', color: 'var(--c-meta)',
        }}>Step {step} of 2</span>
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>
          {step === 1 ? 'What do you want to watch?' : 'How much a month?'}
        </h2>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          {step === 1
            ? 'Pick the headings that matter. Everything filed underneath one of them counts towards it.'
            : 'Give each a figure, and say how long the budget should run.'}
        </p>
      </div>

      {step === 1 ? (
        <>
          <div role="group" aria-label="Which categories to budget" style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8,
          }}>
            {tops.map((c) => {
              const on = picked.has(c.id);
              const ink = `var(--cat-${c.tint}-ink)`;
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)}
                  style={{
                    minHeight: 58, padding: '8px 10px', borderRadius: 13, display: 'flex',
                    alignItems: 'center', gap: 9, textAlign: 'left',
                    transition: 'background .15s, color .15s',
                    ...(on
                      ? { background: ink, color: 'var(--c-on-tint)', border: `1px solid ${ink}` }
                      : { background: 'var(--c-sunk)', color: 'var(--c-meta)', border: '1px solid transparent' }),
                  }}>
                  <Icon name={c.icon} size={19} strokeWidth={1.9} />
                  <span style={{
                    flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 700, lineHeight: 1.2,
                    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere',
                  }}>{c.name}</span>
                  {on && <Icon name="check" size={15} strokeWidth={2.6} />}
                </button>
              );
            })}
          </div>
          <button className="cta" type="button" disabled={picked.size === 0}
            onClick={() => { haptic('select'); setStep(2); }}
            style={{
              minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)',
              opacity: picked.size === 0 ? 0.5 : 1,
            }}>
            {picked.size === 0 ? 'Pick at least one' : `Next · ${picked.size} chosen`}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chosen.map((c) => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Chip icon={c.icon} tint={c.tint} size={36} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{c.name}</span>
                <input name={`c_${c.id}`} inputMode="decimal" className="n"
                  value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="0" aria-label={`Budget for ${c.name}`}
                  style={{
                    width: 116, minHeight: 46, borderRadius: 11, padding: '0 12px',
                    textAlign: 'right', border: '1px solid var(--c-border)',
                    background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
                  }} />
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>From</span>
              <input type="month" name="from" defaultValue={thisMonth} required style={FIELD} />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Runs until</span>
              <input type="month" name="to" defaultValue={defaultEnd} required style={FIELD} />
            </label>
          </div>

          {total > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              <b className="n" style={{ color: 'var(--c-ink)' }}>{format(total)}</b> a month across{' '}
              {filled} {filled === 1 ? 'category' : 'categories'}.
            </p>
          )}

          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cta" type="button" onClick={() => setStep(1)} style={{
              minHeight: 52, padding: '0 16px', borderRadius: 14, fontSize: 'var(--step-0)',
              fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Back</button>
            <button className="cta" type="submit" disabled={pending || filled === 0} style={{
              flex: 1, minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)',
              opacity: pending || filled === 0 ? 0.55 : 1,
            }}>{pending ? 'Setting it up…' : 'Create the budget'}</button>
          </div>
        </>
      )}
    </form>
  );
}

const FIELD: React.CSSProperties = {
  minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
  border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
};
