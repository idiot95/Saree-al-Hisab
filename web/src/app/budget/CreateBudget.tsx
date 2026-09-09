'use client';

import { useActionState, useState } from 'react';
import { Chip } from '../Icon';
import { haptic } from '../haptics';
import { ErrorNote } from '../auth-ui';
import { useMoney } from '@/app/currency';
import { createBudget } from './actions';
import type { Category } from '../CategoryFinder';

/* The first budget a household ever sets.

   Never one category — it is "rent, groceries, school fees, and let us see" —
   so this asks for all of them on one screen and for the date they run until
   once, rather than making somebody fill the same form eight times. Each
   category still becomes its own plan underneath, so any one of them can be
   changed or dropped afterwards without disturbing the rest.

   Tick a category and its amount box appears. Nothing is assumed: a category
   left unticked is a category with no budget, which is a real answer and the
   commonest one. */
export default function CreateBudget({ categories, thisMonth, defaultEnd }: {
  categories: Category[]; thisMonth: string; defaultEnd: string;
}) {
  const [state, act, pending] = useActionState(createBudget, null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const { format } = useMoney();
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const total = Object.entries(amounts)
    .filter(([id]) => picked.has(id))
    .reduce((n, [, v]) => n + Math.round(Number(v || 0) * 100), 0);

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
        <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600 }}>Create a budget</h2>
        <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Choose what you want to keep an eye on, give each a monthly figure, and say how long it
          should run. Every month until then gets the same figures, and you can change any of them
          later.
        </p>
      </div>

      <div role="group" aria-label="Which categories to budget" style={{
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {categories.map((c) => {
          const on = picked.has(c.id);
          return (
            <div key={c.id} style={{
              borderRadius: 13, background: on ? 'var(--c-sunk2)' : 'transparent',
              padding: on ? '6px 8px' : '0 8px', transition: 'background .15s',
            }}>
              <button type="button" aria-pressed={on} onClick={() => toggle(c.id)} style={{
                width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 11,
                textAlign: 'left', color: 'var(--c-ink)',
              }}>
                <span aria-hidden style={{
                  width: 22, height: 22, flex: 'none', borderRadius: 7, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: on ? 'var(--c-primary-hi)' : 'var(--c-sunk)',
                  border: `1px solid ${on ? 'var(--c-primary-hi)' : 'var(--c-border)'}`,
                  color: 'var(--c-on-primary)', fontSize: 13, fontWeight: 700,
                }}>{on ? '✓' : ''}</span>
                <Chip icon={c.icon} tint={c.tint} size={32} />
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 'var(--step--1)', fontWeight: 600,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.parent ? <span style={{ color: 'var(--c-meta)', fontWeight: 500 }}>{c.parent} › </span> : null}
                  {c.name}
                </span>
              </button>
              {on && (
                <input name={`c_${c.id}`} inputMode="decimal" autoFocus
                  value={amounts[c.id] ?? ''}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                  placeholder="How much a month" aria-label={`Budget for ${c.name}`}
                  style={{
                    width: '100%', minHeight: 46, borderRadius: 11, padding: '0 12px',
                    marginBottom: 4, border: '1px solid var(--c-border)',
                    background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
                  }} />
              )}
            </div>
          );
        })}
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
          {picked.size} {picked.size === 1 ? 'category' : 'categories'}.
        </p>
      )}

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <button className="cta" type="submit" disabled={pending || picked.size === 0} style={{
        minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600,
        background: 'var(--g-primary)', color: 'var(--c-on-primary)',
        opacity: pending || picked.size === 0 ? 0.55 : 1,
      }}>
        {pending ? 'Setting it up…' : 'Create the budget'}
      </button>
    </form>
  );
}

const FIELD: React.CSSProperties = {
  minHeight: 50, borderRadius: 13, padding: '0 12px', fontSize: 'var(--field)',
  border: '1px solid var(--c-border)', background: 'var(--c-card)', color: 'var(--c-ink)',
};
