'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { addClaim, abandonClaim } from '../../people/actions';
import { useMoney } from '@/app/currency';
import { useFocusSoon, useKeepOnRefusal, useOnSuccess } from '../../worth/fields';
import { Icon } from '../../Icon';
import { Said, fieldLabel, ghost, selectCls, solid } from '../../form-bits';
import { cn } from '@/lib/utils';

type Person = { id: string; name: string };
type Claim = {
  id: string; person: string; expected_amount: string; received: string;
  outstanding: string; status: string; note: string | null;
};

/* Each status is an icon and a word, never a colour alone. */
const WORD: Record<string, { word: string; icon: string; ink: string }> = {
  open: { word: 'owes you', icon: 'schedule', ink: 'text-foreground' },
  part_paid: { word: 'part paid', icon: 'trending_down', ink: 'text-attention-soft-foreground' },
  settled: { word: 'settled up', icon: 'check_circle', ink: 'text-primary' },
  written_off: { word: 'written off', icon: 'archive', ink: 'text-muted-foreground' },
};

/* Marking an expense as owed does not change the expense. You paid for it, it
   hit the budget, and it stays hit — that is the whole difference between a
   reimbursement and a loan, and the copy has to carry it. */
export default function OwedFor({ txnId, entryAmount, people, claims, canEdit }: {
  txnId: string; entryAmount: number; people: Person[]; claims: Claim[]; canEdit: boolean;
}) {
  const { format, toKeys } = useMoney();
  const [state, act, pending] = useActionState(addClaim, null);
  // Posts directly; a refusal's form reset is undone so the person chosen and the amount typed stay.
  const keep = useKeepOnRefusal(state);
  const [, drop] = useActionState(abandonClaim, null);
  const [open, setOpen] = useState(false);
  // Added: close, so React's reset after a success never leaves the person and the amount disagreeing with the screen.
  // ...and focus goes back to the button the form replaced, while the live region says who now owes what.
  const [opener, focusOpener] = useFocusSoon<HTMLButtonElement>();
  useOnSuccess(state, () => { setOpen(false); focusOpener(); });

  if (people.length === 0 && claims.length === 0) return null;

  return (
    <section aria-labelledby="owed-for" className="mx-[var(--gutter)] mb-4 flex flex-col gap-3 rounded-[18px] bg-card p-[var(--pad)]">
      <h2 id="owed-for" className="text-[15px] font-semibold">Owed back to you</h2>
      <Said>{state?.ok ? state.message : ''}</Said>

      {claims.length > 0 && (
        <ul className="flex flex-col">
          {claims.map((c, i) => {
            const w = WORD[c.status] ?? WORD.open;
            return (
              <li key={c.id} className={cn('flex min-h-14 items-center gap-2.5 py-1.5', i < claims.length - 1 && 'border-b border-border')}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{c.person}</span>
                  <span className={cn('flex items-center gap-1 text-[13px]', w.ink)}>
                    <Icon name={w.icon} size={15} />
                    {w.word}
                    {c.status === 'part_paid' && ` · ${format(Number(c.received))} in`}
                  </span>
                </span>
                <span className={cn('flex-none text-right text-[15px] font-semibold whitespace-nowrap', w.ink)}>
                  {format(Number(c.status === 'settled' ? c.expected_amount : c.outstanding))}
                </span>
                {canEdit && c.status !== 'settled' && c.status !== 'written_off' && (
                  <form action={drop}>
                    <input type="hidden" name="claimId" value={c.id} />
                    <button type="submit" aria-label={`Drop what ${c.person} owes`}
                      className="press flex min-h-11 items-center justify-center px-2 text-[13px] font-semibold text-muted-foreground">
                      Drop
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (open ? (
        <form action={act} {...keep} aria-label="Someone owes me for this" className="flex flex-col gap-3">
          <input type="hidden" name="txnId" value={txnId} />
          <p className="text-sm leading-normal text-muted-foreground">
            This does not change the entry. You paid for it, so it stays in the month&rsquo;s
            spending — what you are recording is that some of it is coming back.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Who owes you</span>
            <select name="counterpartyId" required className={selectCls}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Field label="How much of it" name="amount" inputMode="decimal" required
            defaultValue={toKeys(Math.round(entryAmount / 2))}
            hint={`The entry came to ${format(entryAmount)}.`} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); focusOpener(); }} className={ghost}>Cancel</button>
            <button type="submit" disabled={pending} className={solid}>
              {pending ? 'Saving…' : 'Someone owes me'}
            </button>
          </div>
        </form>
      ) : (
        <button ref={opener} type="button" onClick={() => setOpen(true)}
          className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-muted px-4 text-base font-semibold text-foreground">
          <Icon name="person_add" size={19} />
          {claims.length ? 'Add someone else' : 'Someone owes me for this'}
        </button>
      ))}

      {people.length === 0 && (
        <p className="text-sm text-muted-foreground">Add someone to a tab in Loans first.</p>
      )}
    </section>
  );
}
