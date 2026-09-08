'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { moveDue } from './actions';
import { describeRule, friendlyDate, rewriteRuleTo, type Calendar } from '@/lib/recur';
import { formatHijri, toHijri } from '@/lib/hijri';

/* "Not the 5th this month — the 10th." One date, one question underneath it:
   is that the day from now on? The answer to the question is shown before it
   is asked, in the words the list will use afterwards, so nobody has to
   wonder what "permanently" will do to their schedule. */
export default function MoveDue({ scheduleId, name, dueOn, on, rule, cal, today, onDone, onCancel }: {
  scheduleId: string; name: string;
  /** The rule's date — the occurrence's identity. */
  dueOn: string;
  /** Where it is now: the same, unless already moved once. */
  on: string;
  rule: string; cal: Calendar; today: string;
  onDone: () => void; onCancel: () => void;
}) {
  const [state, act, pending] = useActionState(moveDue, null);
  const [to, setTo] = useState(() => dayAfter(on > today ? on : today));
  const [permanent, setPermanent] = useState(false);
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (!state?.ok || state === handled.current) return;
    handled.current = state;
    onDone();
  }, [state, onDone]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(to) && !Number.isNaN(Date.parse(to));
  const next = valid ? rewriteRuleTo(rule, cal, to) : null;
  const hijri = valid ? formatHijri(toHijri(civil(to)), true) : '';
  const yearly = /FREQ=YEARLY/.test(rule);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input type="hidden" name="scheduleId" value={scheduleId} />
      <input type="hidden" name="dueOn" value={dueOn} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--c-meta)' }}>
          Move {name} to
        </span>
        <input name="to" type="date" required value={to} onChange={(e) => setTo(e.target.value)}
          style={{
            minHeight: 48, borderRadius: 12, border: '1px solid var(--c-border)',
            background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 'var(--field)',
            fontWeight: 600, padding: '0 12px',
          }} />
        <span style={{ fontSize: 'var(--step--1)', color: 'var(--c-meta)' }}>
          {valid ? `${friendlyDate(to)} · ${hijri}` : 'Pick a day.'}
        </span>
      </label>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minHeight: 44, cursor: 'pointer' }}>
        <input type="checkbox" name="permanent" value="yes" checked={permanent} disabled={!next}
          onChange={(e) => setPermanent(e.target.checked)}
          style={{ width: 22, height: 22, marginTop: 2, flex: 'none', accentColor: 'var(--c-seagrass)' }} />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 'var(--step--1)', fontWeight: 600 }}>
            Make this the day, every {yearly ? 'year' : cal === 'hijri' ? 'Hijri month' : 'month'}
          </span>
          <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--c-meta)' }}>
            {!valid ? ''
              : next
                ? permanent
                  ? `From ${friendlyDate(to)}: ${describeRule(next, cal)}. What is already recorded stays as it is.`
                  : `Otherwise this once only — next time it is back to ${describeRule(rule, cal)}.`
                : `Not every ${cal === 'hijri' ? 'Hijri month' : 'month'} has that day, so it can only move this once.`}
          </span>
        </span>
      </label>

      {state && !state.ok && (
        <span role="alert" style={{ fontSize: 'var(--step--1)', color: 'var(--c-danger)' }}>{state.error}</span>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cta" type="button" onClick={onCancel} style={{
          minHeight: 46, padding: '0 14px', borderRadius: 11, fontSize: 'var(--step--1)',
          fontWeight: 600, background: 'var(--c-sunk)', color: 'var(--c-meta)',
        }}>Cancel</button>
        <button className="cta" type="submit" disabled={pending || !valid} style={{
          flex: 1, minHeight: 46, borderRadius: 11, fontSize: 'var(--step-0)', fontWeight: 600,
          background: 'var(--g-primary)', color: 'var(--c-on-primary)',
          opacity: pending || !valid ? 0.6 : 1,
        }}>{pending ? 'Moving…' : permanent ? 'Move it, from now on' : 'Move it, this once'}</button>
      </div>
    </form>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const civil = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};
function dayAfter(iso: string) {
  const { y, m, d } = civil(iso);
  const x = new Date(y, m - 1, d + 1);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
