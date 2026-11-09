'use client';

import { useActionState, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorNote as Problem } from '../../auth-ui';
import { Field } from '../../worth/fields';
import { keepFields } from '../../form-hooks';
import { Icon } from '../../Icon';
import { haptic } from '../../haptics';
import { chip, chipOff, chipOn, chipRow } from '../../form-bits';
import BottomDrawer from '../../BottomDrawer';
import PayPicker from '../../PayPicker';
import { DateChips } from '../../DatePick';
import { useMoney } from '@/app/currency';
import { defaultRef, type Way } from '@/lib/pay';
import { settleTab } from '../actions';

type Owing = {
  /** A person, or null for the tab's own claims. */
  id: string | null; name: string; tint: string; owed: number;
  claims: { id: string; what: string; on: string; outstanding: number }[];
};

/* Money coming back on this tab. From whom — a person on it, or the tab itself
   for what was put on it while nobody was named — then how much (blank is all
   of it, which is what settling up usually means), where it arrived, and when.
   A part payment goes against the oldest entries first unless some are ticked.
   Recorded as money coming back, never as income. */
export default function MoneyBack({ tabId, ways, today, owing }: {
  tabId: string; ways: Way[]; today: string; owing: Owing[];
}) {
  const { format } = useMoney();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [who, setWho] = useState(0);
  const [on, setOn] = useState(today);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [state, act, pending] = useActionState(async (prev: Awaited<ReturnType<typeof settleTab>> | null, fd: FormData) => {
    const r = await settleTab(prev, fd);
    if (r.ok) close();
    return r;
  }, null);

  const from = owing[Math.min(who, owing.length - 1)];
  const chosen = from ? from.claims.filter((c) => ticked.has(c.id)) : [];
  const target = chosen.length ? chosen.reduce((n, c) => n + c.outstanding, 0) : from?.owed ?? 0;

  const short = (on: string) => new Date(`${on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <>
      <button type="button" disabled={owing.length === 0}
        onClick={() => { haptic('select'); setWho(0); setTicked(new Set()); setOpen(true); }}
        className="press flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-body font-semibold text-foreground disabled:opacity-50">
        <Icon name="receivable" size={18} />
        Money back
      </button>

      <BottomDrawer open={open} onClose={close} label="Money back" showTitle>
        {from && (
          /* In a drawer, which needs script to open: keepFields keeps the amount and the ticks after a refusal. */
          <form noValidate onSubmit={keepFields(act)} className="flex flex-col gap-4 pt-0.5">
            <input type="hidden" name="tabId" value={tabId} />
            <input type="hidden" name="counterpartyId" value={from.id ?? ''} />
            <input type="hidden" name="occurred_on" value={on} />

            {owing.length > 1 && (
              <div role="group" aria-label="From" className="flex flex-col gap-2">
                <span className="text-subhead font-medium text-muted-foreground">From</span>
                <div className={chipRow}>
                  {owing.map((o, i) => (
                    <button key={o.id ?? 'tab'} type="button" aria-pressed={i === who}
                      onClick={() => { haptic('select'); setWho(i); setTicked(new Set()); }}
                      className={`${chip} ${i === who ? chipOn : chipOff}`}>
                      {o.name}
                      <span className="font-medium opacity-90">{format(o.owed)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {from.claims.length > 1 && (
              <fieldset className="flex flex-col gap-0.5">
                <legend className="mb-1.5 text-subhead font-medium text-muted-foreground">
                  For which costs — none ticked means all of them
                </legend>
                {from.claims.map((c) => (
                  <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-body">
                    <input type="checkbox" name="claimId" value={c.id} checked={ticked.has(c.id)}
                      onChange={(e) => setTicked((s) => {
                        const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n;
                      })}
                      className="size-[18px] flex-none accent-primary" />
                    <span className="min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]">
                      {c.what} <span className="text-muted-foreground">· {short(c.on)}</span>
                    </span>
                    <span className="tabular-nums">{format(c.outstanding)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <Field label={`Amount — blank is all ${format(target)}`} name="amount"
              inputMode="decimal" placeholder={format(target)} />
            <div role="group" className="flex flex-col gap-1.5">
              <span className="text-subhead font-medium text-muted-foreground">Where it arrived</span>
              <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
            </div>
            <DateChips value={on} onChange={setOn} today={today} dir="past" label="When did it come back" />

            {state && !state.ok && <Problem>{state.error}</Problem>}
            <Button type="submit" disabled={pending} className="h-12 rounded-xl text-headline font-semibold">
              <Icon name="check" size={18} />
              {pending ? 'Recording…' : 'Record what came back'}
            </Button>
            <p className="text-footnote leading-snug text-muted-foreground">
              {chosen.length ? 'Goes against the costs ticked, oldest first.' : 'Goes against the oldest costs first.'}
              {' '}Recorded as money coming back, not income — the spending stays in the month it happened.
            </p>
          </form>
        )}
      </BottomDrawer>
    </>
  );
}
