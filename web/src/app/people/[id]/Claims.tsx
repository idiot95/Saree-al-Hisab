'use client';

import Link from '@/app/NavLink';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Problem } from '../../worth/fields';
import { Icon } from '../../Icon';
import { settleClaim, abandonClaim } from '../actions';
import { useMoney } from '@/app/currency';
import PayPicker from '../../PayPicker';
import RemindShare from './RemindShare';
import { defaultRef, type Way } from '@/lib/pay';

type Claim = {
  id: string; txn_id: string; expected_amount: string; received: string;
  outstanding: string; status: string; note: string | null;
  merchant: string | null; category: string | null; occurred_on: string;
};

export type Bill = { id: string; txn_id: string; name: string; mime: string };

export default function Claims({ claims, ways, canEdit, person, bills = [] }: {
  claims: Claim[]; ways: Way[]; canEdit: boolean; person: string; bills?: Bill[];
}) {
  const { format, toKeys } = useMoney();
  const [settling, setSettling] = useState<string | null>(null);
  const [state, act, pending] = useActionState(settleClaim, null);
  const [, drop] = useActionState(abandonClaim, null);
  const today = new Date().toISOString().slice(0, 10);

  if (claims.length === 0) return null;
  const live = claims.filter((c) => c.status === 'open' || c.status === 'part_paid');

  const word = (status: string) => status === 'settled' ? { icon: 'check_circle', text: 'settled', tone: 'text-primary' }
    : status === 'written_off' ? { icon: 'delete', text: 'written off', tone: 'text-muted-foreground' }
    : null;

  /* Page-level forms: settleClaim and abandonClaim go straight into useActionState and post without script. */
  return (
    <section aria-label="Owed for shared costs" className="mx-[var(--gutter)] flex flex-col gap-1.5">
      <h2 className="px-0.5 text-[13px] font-semibold text-muted-foreground">Owed for shared costs</h2>
      <p className="px-0.5 pb-1 text-[13px] leading-relaxed text-muted-foreground">
        Things you paid for that they owe part of. Already counted in the month you bought
        them — this is only what is coming back.
      </p>

      <ul className="overflow-hidden rounded-[18px] bg-card">
        {claims.map((c) => {
          const done = word(c.status);
          const live = c.status === 'open' || c.status === 'part_paid';
          return (
            <li key={c.id} className="flex flex-col gap-2.5 border-b border-border px-3.5 py-3 last:border-b-0">
              <div className="flex items-center gap-3">
                <Link transitionTypes={['nav-forward']} href={`/entries/${c.txn_id}`}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-0.5 text-foreground">
                  <span className="text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{c.merchant || c.category || 'Entry'}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {new Date(c.occurred_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {c.status === 'part_paid' && ` · ${format(Number(c.received))} in`}
                    {done && <span className={`inline-flex items-center gap-0.5 ${done.tone}`}>· <Icon name={done.icon} size={13} />{done.text}</span>}
                    {c.note ? ` · ${c.note}` : ''}
                  </span>
                </Link>
                <span className={`flex-none text-[15px] font-semibold tabular-nums ${done ? 'text-muted-foreground' : 'text-money-in'}`}>
                  {live ? '+' : ''}{format(Number(live ? c.outstanding : c.expected_amount))}
                </span>
              </div>

              {canEdit && live && (
                settling === c.id ? (
                  <form action={act} className="flex flex-col gap-2.5">
                    <input type="hidden" name="claimId" value={c.id} />
                    <Field label="How much came back" name="amount" inputMode="decimal" required
                      autoFocus defaultValue={toKeys(Number(c.outstanding))} />
                    <Field label="Date" name="occurred_on" type="date" defaultValue={today} required />
                    <div role="group" className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium text-muted-foreground">How it came back</span>
                      <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
                    </div>
                    {state && !state.ok && <Problem>{state.error}</Problem>}
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => setSettling(null)}
                        className="h-12 rounded-xl px-3.5 font-semibold">Cancel</Button>
                      <Button type="submit" disabled={pending} className="h-12 flex-1 rounded-xl text-base font-semibold">
                        {pending ? 'Saving…' : 'Record it'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => setSettling(c.id)}
                        className="h-11 flex-1 rounded-xl font-semibold">They paid me</Button>
                      <form action={drop}>
                        <input type="hidden" name="claimId" value={c.id} />
                        <Button type="submit" variant="ghost" className="h-11 rounded-xl px-3.5 font-semibold text-muted-foreground">
                          Write off
                        </Button>
                      </form>
                    </div>
                    {/* Asking for it back, with the bill attached where the phone can carry one. Sent through the
                        share sheet, so it goes to whoever they already talk to. */}
                    <RemindShare person={person} amount={format(Number(c.outstanding))}
                      what={c.merchant || c.category || 'a shared cost'}
                      on={new Date(c.occurred_on).toISOString().slice(0, 10)}
                      bills={bills.filter((b) => b.txn_id === c.txn_id)
                        .map((b) => ({ id: b.id, name: b.name, mime: b.mime }))} />
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
      {live.length === 0 && (
        <p className="px-0.5 text-[13px] text-muted-foreground">Nothing outstanding on shared costs.</p>
      )}
    </section>
  );
}
