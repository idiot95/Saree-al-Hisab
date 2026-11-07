'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Chip, Icon } from '../Icon';
import { ErrorNote as Problem } from '../auth-ui';
import { saveBudget } from './actions';
import { useMoney } from '@/app/currency';
import { haptic } from '../haptics';

type Row = {
  category_id: string; name: string; tint: string; icon: string;
  budget: string; spent: string; archived: boolean;
  /** Children with spend this month, largest first — the "of which" line. */
  kids: { id: string; name: string; icon: string; spent: string }[];
};

/* "Adjust this month only": every category, including the ones with nothing against them, for one month,
   without touching the budget behind it. The action goes straight into useActionState, so it posts as a form.

   Save rides along the TOP (sticky, data-topbar so the Back pill sits under it): after eight categories a Save at
   the foot is off the screen, and one pinned to the bottom would sit under the keyboard. The total and each row's
   figure follow what is typed, so "what does that come to" never costs a round trip — as plain format() text:
   nothing rolls while somebody is typing (the owner's rule; Figure is for read screens). */
export default function BudgetForm({ month, rows, canEdit }: {
  month: string; rows: Row[]; canEdit: boolean;
}) {
  const { symbol, toKeys, fromKeys, format } = useMoney();
  /* Whole units in the box, minor units in the ledger. */
  const toField = (minor: string) => (Number(minor) === 0 ? '' : toKeys(Number(minor)));
  const ofField = (s: string | undefined) => fromKeys((s ?? '').replace(/[^0-9.]/g, '')) || 0;
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

      <div data-topbar className="sticky top-0 z-20 mb-3 flex items-center gap-3 border-b border-border bg-card px-4 py-2.5">
        <span className="flex flex-1 flex-col">
          <span className="text-xs text-muted-foreground">Month total</span>
          <span data-month-total className="text-xl font-bold tabular-nums">{format(total)}</span>
        </span>
        {canEdit && (
          <Button type="submit" disabled={pending || !changed} variant={changed ? 'default' : 'secondary'}
            className="h-11 rounded-xl px-5 text-base font-semibold in-data-[platform=android]:h-12">
            {pending ? 'Saving…' : changed ? 'Save' : <><Icon name="check" size={18} />Saved</>}
          </Button>
        )}
      </div>

      {state && !state.ok && <div className="mx-4 mb-3"><Problem>{state.error}</Problem></div>}
      {state?.ok && !changed && (
        <p role="status" className="mx-4 mb-3 flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-accent-foreground">
          <Icon name="check_circle" size={18} />{state.message}
        </p>
      )}

      <ul className="px-4">
        {rows.map((r) => {
          const spent = Number(r.spent);
          const budget = ofField(draft[r.category_id]);
          const over = budget > 0 && spent > budget;
          return (
            <li key={r.category_id} className="flex min-h-[72px] items-center gap-3 border-b border-border py-2 last:border-b-0">
              <Chip icon={r.icon} tint={r.tint} size={36} radius={10} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-medium [overflow-wrap:anywhere]">
                  {r.name}
                  {r.archived && (
                    <span className="ml-1.5 rounded-md bg-muted px-1.5 py-0.5 align-middle text-[10px] font-bold tracking-wide text-muted-foreground">RETIRED</span>
                  )}
                </span>
                {budget > 0 && (
                  <span role="img" aria-label={`${r.name}: ${Math.round((spent / budget) * 100)}% of its budget spent${over ? ', over budget' : ''}`}
                    data-bar={r.category_id}
                    className="block h-1.5 max-w-40 overflow-hidden rounded-full bg-muted">
                    <span className={`block h-full rounded-full ${over ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
                  </span>
                )}
                <span className={`flex flex-wrap items-center gap-x-1 text-xs tabular-nums ${over ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {over && <Icon name="warning" size={13} />}
                  {budget > 0
                    ? <>{format(spent)} of {format(budget)}{over && ' · over budget'}</>
                    : spent > 0 ? <>{format(spent)} spent · not budgeted</> : 'Nothing spent yet'}
                </span>
              </span>

              <label className={`flex h-12 flex-none items-center gap-1 rounded-xl px-2.5 ${canEdit ? 'border border-input bg-background' : ''}`}>
                <span className="text-sm text-muted-foreground">{symbol}</span>
                <input
                  name={`c_${r.category_id}`} inputMode="decimal" disabled={!canEdit} aria-label={`${r.name} for this month`}
                  value={draft[r.category_id] ?? ''} placeholder="0"
                  onChange={(e) => setDraft((d) => ({ ...d, [r.category_id]: e.target.value.replace(/[^0-9.]/g, '') }))}
                  className="h-11 w-20 bg-transparent text-right text-[length:var(--field)] font-semibold tabular-nums outline-none"
                />
              </label>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
