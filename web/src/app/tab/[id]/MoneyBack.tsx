'use client';

import { useActionState, useCallback, useState } from 'react';
import { Field, ErrorNote } from '../../auth-ui';
import { Icon, tintOf } from '../../Icon';
import { haptic } from '../../haptics';
import Sheet from '../../Sheet';
import PayPicker from '../../PayPicker';
import { DateChips } from '../../DatePick';
import { choice } from '../../choice';
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

  return (
    <>
      <button type="button" className="cta" disabled={owing.length === 0}
        onClick={() => { haptic('select'); setWho(0); setTicked(new Set()); setOpen(true); }} style={{
          flex: 1, minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--c-card)', border: '1px solid var(--c-border)', color: 'var(--c-ink)',
          opacity: owing.length === 0 ? 0.5 : 1,
        }}>
        <Icon name="receivable" size={18} strokeWidth={2} />
        Money back
      </button>

      <Sheet open={open} onClose={close} label="Money back">
        {from && (
          <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 2 }}>
            <h2 style={{ fontSize: 'var(--step-2)', fontWeight: 600 }}>Money back</h2>
            <input type="hidden" name="tabId" value={tabId} />
            <input type="hidden" name="counterpartyId" value={from.id ?? ''} />
            <input type="hidden" name="occurred_on" value={on} />

            {owing.length > 1 && (
              <div role="group" aria-label="From" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>From</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {owing.map((o, i) => (
                    <button key={o.id ?? 'tab'} type="button" aria-pressed={i === who}
                      onClick={() => { haptic('select'); setWho(i); setTicked(new Set()); }} style={{
                        minHeight: 44, padding: '0 14px', borderRadius: 999, display: 'flex', alignItems: 'center',
                        gap: 6, fontSize: 'var(--step--1)', fontWeight: 600,
                        ...choice(i === who, tintOf(o.tint)[1]),
                      }}>
                      {o.name}
                      <span style={{ fontWeight: 500, opacity: 0.9 }}>{format(o.owed)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {from.claims.length > 1 && (
              <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)', padding: 0, marginBottom: 6 }}>
                  For which costs — none ticked means all of them
                </legend>
                {from.claims.map((c) => (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: 'var(--step--1)',
                  }}>
                    <input type="checkbox" name="claimId" value={c.id} checked={ticked.has(c.id)}
                      onChange={(e) => setTicked((s) => {
                        const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n;
                      })}
                      style={{ width: 18, height: 18, margin: 0, flex: 'none', accentColor: 'var(--c-seagrass)' }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.what} <span style={{ color: 'var(--c-meta)' }}>· {new Date(`${c.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </span>
                    <span className="t">{format(c.outstanding)}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <Field label={`Amount — blank is all ${format(target)}`} name="amount"
              inputMode="decimal" placeholder={format(target)} />
            <div role="group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>Where it arrived</span>
              <PayPicker name="paidWith" ways={ways} defaultValue={defaultRef(ways)} />
            </div>
            <DateChips value={on} onChange={setOn} today={today} dir="past" label="When did it come back" />

            {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
            <button className="cta" type="submit" disabled={pending} style={{
              minHeight: 52, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: pending ? 0.65 : 1,
            }}>
              <Icon name="check" size={18} strokeWidth={2.2} />
              {pending ? 'Recording…' : 'Record what came back'}
            </button>
            <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
              {chosen.length ? 'Goes against the costs ticked, oldest first.' : 'Goes against the oldest costs first.'}
              {' '}Recorded as money coming back, not income — the spending stays in the month it happened.
            </p>
          </form>
        )}
      </Sheet>
    </>
  );
}
