'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { addClaim, abandonClaim } from '../../people/actions';
import { useMoney } from '@/app/currency';
import { useKeepOnRefusal } from '../../worth/fields';

type Person = { id: string; name: string };
type Claim = {
  id: string; person: string; expected_amount: string; received: string;
  outstanding: string; status: string; note: string | null;
};

const WORD: Record<string, [string, string]> = {
  open: ['owes you', 'var(--foreground)'],
  part_paid: ['part paid', 'var(--attention-soft-foreground)'],
  settled: ['settled up', 'var(--primary)'],
  written_off: ['written off', 'var(--muted-foreground)'],
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

  if (people.length === 0 && claims.length === 0) return null;

  return (
    <section className="border border-border" style={{
      margin: '0 var(--gutter) 16px', background: 'var(--card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <h2 style={{ margin: 0, fontSize: 'var(--step-0)', fontWeight: 600 }}>Owed back to you</h2>

      {claims.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
          {claims.map((c, i) => {
            const [word, colour] = WORD[c.status] ?? WORD.open;
            return (
              <li key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, minHeight: 56,
                borderBottom: i === claims.length - 1 ? undefined : '1px solid var(--border)',
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{c.person}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: colour }}>
                    {word}
                    {c.status === 'part_paid' && ` · ${format(Number(c.received))} in`}
                  </span>
                </span>
                <span className="t amt" style={{ fontSize: 'var(--step-0)', color: colour }}>
                  {format(Number(c.status === 'settled' ? c.expected_amount : c.outstanding))}
                </span>
                {canEdit && c.status !== 'settled' && c.status !== 'written_off' && (
                  <form action={drop}>
                    <input type="hidden" name="claimId" value={c.id} />
                    <button type="submit" style={{
                      minHeight: 44, padding: '0 8px', fontSize: 'var(--step--2)', fontWeight: 600,
                      color: 'var(--muted-foreground)', background: 'transparent',
                    }}>Drop</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (open ? (
        <form action={act} {...keep} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="hidden" name="txnId" value={txnId} />
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            This does not change the entry. You paid for it, so it stays in the month&rsquo;s
            spending — what you are recording is that some of it is coming back.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>Who owes you</span>
            <select name="counterpartyId" required style={{
              minHeight: 52, borderRadius: 13, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)', fontSize: 'var(--field)',
              fontWeight: 600, padding: '0 12px',
            }}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Field label="How much of it" name="amount" inputMode="decimal" required
            defaultValue={toKeys(Math.round(entryAmount / 2))}
            hint={`The entry came to ${format(entryAmount)}.`} />
          <Field label="Note (optional)" name="note" maxLength={200} />
          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="cta" type="button" onClick={() => setOpen(false)} style={{
              minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--muted)', color: 'var(--muted-foreground)',
            }}>Cancel</button>
            <button className="cta" type="submit" disabled={pending} style={{
              flex: 1, minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: pending ? 0.6 : 1,
            }}>{pending ? 'Saving…' : 'Someone owes me'}</button>
          </div>
        </form>
      ) : (
        <button className="cta" type="button" onClick={() => setOpen(true)} style={{
          minHeight: 48, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--muted)', color: 'var(--foreground)',
        }}>
          {claims.length ? 'Add someone else' : 'Someone owes me for this'}
        </button>
      ))}

      {people.length === 0 && (
        <p style={{ margin: 0, fontSize: 'var(--step--1)', color: 'var(--muted-foreground)' }}>
          Add someone to a tab in the Loan centre first.
        </p>
      )}
    </section>
  );
}
