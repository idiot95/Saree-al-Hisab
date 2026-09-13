'use client';

import Link from '@/app/NavLink';
import { useActionState, useState } from 'react';
import { ErrorNote } from '../../../auth-ui';
import { Icon } from '../../../Icon';
import { haptic } from '../../../haptics';
import { DateChips } from '../../../DatePick';
import { useMoney } from '@/app/currency';
import { finishReconcile, undoReconcile } from '../../reconcile/actions';

type Entry = { id: string; on: string; what: string; via: string | null; signed: number };

/* The working of a reconciliation, live as it is typed.

   Statement date and balance first — for a card, what the statement says is
   owed, which is the number printed biggest on it. Then every entry up to that
   date not yet matched, ticked by default, because most of them are on the
   statement. Untick what the statement does not show (a cheque not cleared,
   a payment still pending) and the difference moves as you do. At zero it
   finishes. Not at zero, the two honest ways out are said plainly: add the
   entry the books are missing, or record what is left as one adjustment. */
export default function Reconcile({ accountId, credit, today, lastOn, cleared, entries }: {
  accountId: string; credit: boolean; today: string; lastOn: string | null;
  /** The balance everything already matched adds up to, signed as balances are. */
  cleared: number; entries: Entry[];
}) {
  const { format, fromKeys } = useMoney();
  const [on, setOn] = useState(today);
  const [keys, setKeys] = useState('');
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [state, act, pending] = useActionState(finishReconcile, null);

  const upTo = entries.filter((e) => e.on <= on);
  const later = entries.length - upTo.length;
  const ticked = upTo.filter((e) => !unticked.has(e.id));
  const typed = keys.trim() !== '';
  const magnitude = typed ? fromKeys(keys.replace(/[^0-9.]/g, '')) : 0;
  // A card that owes is negative in the books; the statement prints it positive.
  const statement = credit ? -magnitude : magnitude;
  const reached = cleared + ticked.reduce((n, e) => n + e.signed, 0);
  const difference = statement - reached;
  const matches = typed && difference === 0;
  const shown = (v: number) => format(Math.abs(v));
  const signedText = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${format(Math.abs(v))}`;

  const toggle = (id: string) => setUnticked((s) => {
    haptic('select');
    const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 20 }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="on" value={on} />
      <input type="hidden" name="balance" value={String(statement)} />
      {ticked.map((e) => <input key={e.id} type="hidden" name="txnId" value={e.id} />)}

      <section className="el card" style={{
        margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <DateChips value={on} onChange={(v) => { setOn(v); setUnticked(new Set()); }} today={today}
          dir="past" min={lastOn ?? undefined} max={today} label="Statement date" />
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-meta)' }}>
            {credit ? 'What the statement says you owe' : 'Closing balance on the statement'}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, minHeight: 58, padding: '0 14px',
            borderRadius: 14, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
          }}>
            <input inputMode="decimal" value={keys} placeholder="0" autoComplete="off"
              aria-label={credit ? 'Amount owed on the statement' : 'Statement balance'}
              onChange={(e) => setKeys(e.target.value.replace(/[^0-9.]/g, ''))}
              className="t" style={{
                flex: 1, minHeight: 54, border: 0, background: 'transparent', width: '100%',
                color: 'var(--c-ink)', fontSize: 'var(--step-3)', letterSpacing: '-.02em',
              }} />
          </span>
          {typed && <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>{format(magnitude)}</span>}
        </label>
      </section>

      <section aria-live="polite" className="quiet" style={{
        margin: '0 var(--gutter)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <Line label="Statement" value={typed ? shown(statement) : '—'} />
        <Line label={`Ticked off${ticked.length ? ` (${ticked.length})` : ''}`} value={shown(reached)} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--c-border)',
          fontSize: 'var(--step-0)', fontWeight: 600,
          color: !typed ? 'var(--c-meta)' : matches ? 'var(--c-ok)' : 'var(--c-warn)',
        }}>
          {typed && <Icon name={matches ? 'check' : 'receivable'} size={17} strokeWidth={2.3} />}
          <span style={{ flex: 1 }}>{!typed ? 'Enter the statement balance' : matches ? 'It matches' : 'Difference'}</span>
          {typed && !matches && <span className="t">{shown(difference)}</span>}
        </div>
      </section>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 var(--gutter) 11px' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--step-1)', fontWeight: 600, letterSpacing: '-.012em' }}>
            Not matched yet
          </h2>
          <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          {upTo.length > 1 && (
            <button type="button" onClick={() => { haptic('select'); setUnticked(unticked.size ? new Set() : new Set(upTo.map((e) => e.id))); }}
              style={{ minHeight: 44, padding: '0 4px', fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--c-teal)' }}>
              {unticked.size ? 'Tick all' : 'Untick all'}
            </button>
          )}
        </div>
        <section className="el card" style={{
          margin: '0 var(--gutter)', background: 'var(--c-card)', borderRadius: 18, padding: '0 var(--pad)',
        }}>
          {upTo.map((e, i) => {
            const isOn = !unticked.has(e.id);
            return (
              <label key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, cursor: 'pointer',
                borderBottom: i === upTo.length - 1 ? undefined : '1px solid var(--c-rule)',
              }}>
                <input type="checkbox" checked={isOn} onChange={() => toggle(e.id)}
                  style={{ width: 20, height: 20, margin: 0, flex: 'none', accentColor: 'var(--c-seagrass)' }} />
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, opacity: isOn ? 1 : 0.6 }}>
                  <span style={{
                    fontSize: 'var(--step-0)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.what}</span>
                  <span style={{ fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
                    {new Date(`${e.on}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {e.via ? ` · ${e.via}` : ''}
                    {isOn ? '' : ' · not on the statement'}
                  </span>
                </span>
                <span className="t amt" style={{
                  fontSize: 'var(--step-0)', opacity: isOn ? 1 : 0.6,
                  color: e.signed > 0 ? 'var(--c-in)' : 'var(--c-out)',
                }}>{signedText(e.signed)}</span>
              </label>
            );
          })}
          {upTo.length === 0 && (
            <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
              Nothing to match up to this date.
            </p>
          )}
        </section>
        {later > 0 && (
          <p style={{ margin: '8px 20px 0', fontSize: 'var(--step--2)', color: 'var(--c-meta)' }}>
            {later} {later === 1 ? 'entry is' : 'entries are'} dated after the statement and {later === 1 ? 'waits' : 'wait'} for the next one.
          </p>
        )}
      </div>

      <div style={{ margin: '0 var(--gutter)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
        {matches || !typed ? (
          <button type="submit" name="adjust" value="no" disabled={!matches || pending} className="el cta" style={{
            minHeight: 54, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600,
            background: 'var(--g-primary)', color: 'var(--c-on-primary)', opacity: !matches || pending ? 0.55 : 1,
          }}>
            <Icon name="check" size={18} strokeWidth={2.2} />
            {pending ? 'Saving…' : 'Finish — it matches'}
          </button>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
              {difference > 0
                ? `The statement has ${shown(difference)} more than the books. Something that came in may be missing here, or something going out here is not on the statement yet.`
                : `The books have ${shown(difference)} more than the statement. Something that went out may be missing here, or something coming in here is not on the statement yet.`}
            </p>
            <Link href="/add" transitionTypes={['nav-forward']} className="el cta" style={{
              minHeight: 52, borderRadius: 15, fontSize: 'var(--step-0)', fontWeight: 600, textDecoration: 'none',
              background: 'var(--g-primary)', color: 'var(--c-on-primary)',
            }}>
              <Icon name="plus" size={18} strokeWidth={2.2} />
              Add the missing entry
            </Link>
            <button type="submit" name="adjust" value="yes" disabled={pending} className="cta" style={{
              minHeight: 50, borderRadius: 13, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-ink)', opacity: pending ? 0.6 : 1,
            }}>
              {pending ? 'Saving…' : `Record ${signedText(difference)} as an adjustment`}
            </button>
            <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
              An adjustment brings the balance in line on the statement date. It is not spending and not
              income, and undoing this match deletes it.
            </p>
          </>
        )}
      </div>
    </form>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 'var(--step--1)' }}>
      <span style={{ flex: 1, color: 'var(--c-meta)' }}>{label}</span>
      <span className="t">{value}</span>
    </div>
  );
}

/** Undo, on the latest statement only — asked once, then done. */
export function UndoLatest({ id }: { id: string }) {
  const [sure, setSure] = useState(false);
  const [state, act, pending] = useActionState(undoReconcile, null);
  return (
    <form action={act} onSubmit={(e) => { if (!sure) { e.preventDefault(); haptic('select'); setSure(true); } }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="cta" style={{
        minHeight: 44, padding: '0 12px', borderRadius: 11, fontSize: 'var(--step--1)', fontWeight: 600,
        background: sure ? 'var(--c-danger-tint)' : 'transparent', color: sure ? 'var(--c-danger)' : 'var(--c-meta)',
      }}>{pending ? 'Undoing…' : sure ? 'Yes, undo' : 'Undo'}</button>
      {state && !state.ok && <span role="alert" style={{ fontSize: 'var(--step--2)', color: 'var(--c-danger)' }}>{state.error}</span>}
    </form>
  );
}
