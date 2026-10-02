'use client';

import Link from '@/app/NavLink';
import { Chip, tintOf } from '../Icon';
import { useActionState, useEffect, useState } from 'react';
import { ErrorNote } from '../auth-ui';
import { saveBudget } from './actions';
import { useMoney } from '@/app/currency';
import { haptic } from '../haptics';

type Row = {
  category_id: string; name: string; tint: string; icon: string;
  budget: string; spent: string; archived: boolean;
  /** Children with spend this month, largest first — the "of which" line. */
  kids: { id: string; name: string; icon: string; spent: string }[];
};



export default function BudgetForm({ month, rows, canEdit }: {
  month: string; rows: Row[]; canEdit: boolean;
}) {
  const { format, toKeys, fromKeys } = useMoney();
  /* Whole units in the box, minor units in the ledger. */
  const toField = (minor: string) => (Number(minor) === 0 ? '' : toKeys(Number(minor)));
  const ofField = (s: string | undefined) => fromKeys((s ?? '').replace(/[^0-9.]/g, ''));
  const [state, act, pending] = useActionState(saveBudget, null);
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.category_id, toField(r.budget)])),
  );

  // Saved or refused, the phone says which before the eye finds the note.
  useEffect(() => { if (state) haptic(state.ok ? 'success' : 'warn'); }, [state]);

  const total = rows.reduce((n, r) => n + ofField(draft[r.category_id]), 0);
  const changed = rows.some((r) => (draft[r.category_id] ?? '') !== toField(r.budget));

  return (
    <form action={act}>
      <input type="hidden" name="month" value={month} />

      {/* Fitts's Law, with a phone in mind: after eight categories the Save
          button is off the bottom of the screen, and a bar pinned to the
          BOTTOM would sit under the keyboard the moment someone typed. So it
          rides along the top, where nothing covers it.

          Doherty Threshold: the total recalculates as you type rather than on
          submit, so the answer to "what does that come to" never costs a round
          trip. */}
      <div data-topbar style={{
        position: 'sticky', top: 0, zIndex: 20, margin: '0 0 14px',
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--background)', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '.03em' }}>
            MONTH TOTAL
          </span>
          <span className="t" style={{ fontSize: 'var(--step-2)', letterSpacing: '-.015em' }}>{format(total)}</span>
        </span>
        {canEdit && (
          <button className="cta" type="submit" disabled={pending || !changed} style={{
            minHeight: 46, padding: '0 18px', borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
            background: changed ? 'var(--primary)' : 'var(--muted)',
            color: changed ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
            opacity: pending ? 0.6 : 1,
          }}>
            {pending ? 'Saving…' : changed ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      <div className="border border-border" style={{
        margin: '0 var(--gutter) 14px', background: 'var(--card)', borderRadius: 18, padding: '0 var(--pad)',
      }}>
        {rows.map((r, i) => {
          const spent = Number(r.spent);
          const budget = ofField(draft[r.category_id]);
          const over = budget > 0 && spent > budget;
          return (
            <div key={r.category_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
              borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--border)',
            }}>
              <Chip icon={r.icon} tint={r.tint} size={38} />

              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                  {r.name}
                  {r.archived && (
                    <span style={{
                      marginLeft: 7, fontSize: 'var(--step--2)', fontWeight: 700, letterSpacing: '.03em',
                      padding: '3px 6px', borderRadius: 6,
                      background: 'var(--muted)', color: 'var(--muted-foreground)',
                    }}>RETIRED</span>
                  )}
                </span>
                {/* How close this category is to its own line, in its own
                    colour. A row of these is the quickest read on the screen:
                    you see which one is about to go over without comparing
                    any figures. */}
                {budget > 0 && (
                  <span style={{
                    height: 5, borderRadius: 999, background: 'var(--muted)',
                    overflow: 'hidden', maxWidth: 150,
                  }}>
                    <span style={{
                      display: 'block', height: '100%', borderRadius: 999,
                      width: `${Math.min(100, (spent / budget) * 100)}%`,
                      backgroundColor: over ? 'var(--destructive)' : tintOf(r.tint)[1],
                    }} />
                  </span>
                )}
                {spent > 0 ? (
                  <Link transitionTypes={['nav-forward']} href={`/entries?m=${month}&c=${r.category_id}`} style={{
                    fontSize: 'var(--step--2)', textDecoration: 'none',
                    color: over ? 'var(--destructive)' : 'var(--muted-foreground)', fontWeight: 600,
                  }}>
                    {format(spent)} of {format(budget || 0)}
                    {over && ` · ${format(spent - budget)} over`}
                  </Link>
                ) : (
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>nothing spent yet</span>
                )}
                {/* Where a parent's month went, by child — the line the
                    household nests categories to get. Each is a link into
                    that child's entries alone. */}
                {r.kids.some((k) => Number(k.spent) > 0) && (
                  <span style={{
                    fontSize: 'var(--step--2)', color: 'var(--muted-foreground)', lineHeight: 1.5,
                    display: 'flex', flexWrap: 'wrap', columnGap: 4, marginTop: 2,
                  }}>
                    <span>of which</span>
                    {r.kids.filter((k) => Number(k.spent) > 0).map((k, j, all) => (
                      <Link key={k.id} transitionTypes={['nav-forward']} href={`/entries?m=${month}&c=${k.id}`}
                        style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                        {k.name} {format(Number(k.spent))}{j < all.length - 1 ? ' ·' : ''}
                      </Link>
                    ))}
                  </span>
                )}
              </span>

              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, flex: 'none',
                borderRadius: 11, padding: '0 10px', minHeight: 46,
                background: canEdit ? 'var(--background)' : 'transparent',
                border: canEdit ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 'var(--step--1)', color: 'var(--muted-foreground)' }}>₹</span>
                <input
                  name={`c_${r.category_id}`} inputMode="decimal" disabled={!canEdit}
                  value={draft[r.category_id] ?? ''} placeholder="0"
                  onChange={(e) => setDraft((d) => ({
                    ...d, [r.category_id]: e.target.value.replace(/[^0-9.]/g, ''),
                  }))}
                  style={{
                    width: 88, minHeight: 44, border: 0, background: 'transparent',
                    color: 'var(--foreground)', fontSize: 'var(--field)', fontWeight: 600, textAlign: 'right',
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      {state && !state.ok && (
        <div style={{ margin: '0 var(--gutter) 12px' }}><ErrorNote>{state.error}</ErrorNote></div>
      )}
      {state?.ok && !changed && (
        <p role="status" style={{
          margin: '0 var(--gutter) 12px', padding: '11px 13px', borderRadius: 12,
          background: 'var(--accent)', color: 'var(--primary)', fontSize: 'var(--step--1)', fontWeight: 600,
        }}>{state.message}</p>
      )}

    </form>
  );
}
