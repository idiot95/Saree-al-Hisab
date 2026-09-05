'use client';

import { useActionState, useState } from 'react';
import { ErrorNote } from '../auth-ui';
import { saveBudget } from './actions';
import { format } from '@/lib/money';

type Row = { category_id: string; name: string; tint: string; budget: string; spent: string };

const TINT: Record<string, [string, string]> = {
  green: ['var(--cat-green)', 'var(--cat-green-ink)'],
  orange: ['var(--cat-orange)', 'var(--cat-orange-ink)'],
  blue: ['var(--cat-blue)', 'var(--cat-blue-ink)'],
  purple: ['var(--cat-purple)', 'var(--cat-purple-ink)'],
  pink: ['var(--cat-pink)', 'var(--cat-pink-ink)'],
  cyan: ['var(--cat-cyan)', 'var(--cat-cyan-ink)'],
  rust: ['var(--cat-rust)', 'var(--cat-rust-ink)'],
  indigo: ['var(--cat-indigo)', 'var(--cat-indigo-ink)'],
};

/** Rupees in the box, paise in the ledger. */
const toField = (minor: string) => (Number(minor) === 0 ? '' : String(Number(minor) / 100));

export default function BudgetForm({ month, rows, canEdit }: {
  month: string; rows: Row[]; canEdit: boolean;
}) {
  const [state, act, pending] = useActionState(saveBudget, null);
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(rows.map((r) => [r.category_id, toField(r.budget)])),
  );

  const total = rows.reduce((n, r) => n + Math.round((Number(draft[r.category_id]) || 0) * 100), 0);
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
      <div style={{
        position: 'sticky', top: 0, zIndex: 20, margin: '0 0 14px',
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)',
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-meta)', letterSpacing: '.03em' }}>
            MONTH TOTAL
          </span>
          <span className="t" style={{ fontSize: 21, letterSpacing: '-.015em' }}>{format(total)}</span>
        </span>
        {canEdit && (
          <button type="submit" disabled={pending || !changed} style={{
            minHeight: 46, padding: '0 18px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: changed ? 'var(--c-seagrass)' : 'var(--c-sunk)',
            color: changed ? 'var(--c-on-fill)' : 'var(--c-meta)',
            opacity: pending ? 0.6 : 1,
          }}>
            {pending ? 'Saving…' : changed ? 'Save' : 'Saved'}
          </button>
        )}
      </div>

      <div className="el" style={{
        margin: '0 18px 14px', background: 'var(--c-card)', borderRadius: 18, padding: '0 16px',
      }}>
        {rows.map((r, i) => {
          const [bg, ink] = TINT[r.tint] ?? ['var(--cat-neutral)', 'var(--cat-neutral-ink)'];
          const spent = Number(r.spent);
          const budget = Math.round((Number(draft[r.category_id]) || 0) * 100);
          const over = budget > 0 && spent > budget;
          return (
            <div key={r.category_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 74,
              borderBottom: i === rows.length - 1 ? undefined : '1px solid var(--c-rule)',
            }}>
              <span style={{
                width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'flex',
                alignItems: 'center', justifyContent: 'center', background: bg, color: ink,
                fontSize: 13, fontWeight: 700,
              }}>{r.name.slice(0, 2).toUpperCase()}</span>

              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
                <span style={{ fontSize: 12, color: over ? 'var(--c-danger)' : 'var(--c-meta)' }}>
                  {spent > 0 ? `${format(spent)} spent` : 'nothing spent yet'}
                </span>
              </span>

              <span style={{
                display: 'flex', alignItems: 'center', gap: 4, flex: 'none',
                borderRadius: 11, padding: '0 10px', minHeight: 46,
                background: canEdit ? 'var(--c-sunk2)' : 'transparent',
                border: canEdit ? '1px solid var(--c-border)' : 'none',
              }}>
                <span style={{ fontSize: 14, color: 'var(--c-meta)' }}>₹</span>
                <input
                  name={`c_${r.category_id}`} inputMode="decimal" disabled={!canEdit}
                  value={draft[r.category_id] ?? ''} placeholder="0"
                  onChange={(e) => setDraft((d) => ({
                    ...d, [r.category_id]: e.target.value.replace(/[^0-9.]/g, ''),
                  }))}
                  style={{
                    width: 88, minHeight: 44, border: 0, background: 'transparent',
                    color: 'var(--c-ink)', fontSize: 16, fontWeight: 600, textAlign: 'right',
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>

      {state && !state.ok && (
        <div style={{ margin: '0 18px 12px' }}><ErrorNote>{state.error}</ErrorNote></div>
      )}
      {state?.ok && !changed && (
        <p role="status" style={{
          margin: '0 18px 12px', padding: '11px 13px', borderRadius: 12,
          background: 'var(--c-ok-tint)', color: 'var(--c-ok)', fontSize: 13.5, fontWeight: 600,
        }}>{state.message}</p>
      )}

    </form>
  );
}
