'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { moveDue } from './actions';
import { keepFields } from '../form-hooks';
import { describeRule, friendlyDate, friendlyDay, inWords, rewriteRuleTo, shiftDay, type Calendar } from '@/lib/recur';
import { DateChips } from '../DatePick';
import { formatHijri, toHijri } from '@/lib/hijri';
import { fieldLabel, ghost, solid } from '../form-bits';
import { ErrorNote } from '../auth-ui';

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
  const [to, setTo] = useState(() => shiftDay(on > today ? on : today, 1));
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
    /* JS-only: the move opens from a swipe, so it submits through keepFields and React never resets the box. */
    <form onSubmit={keepFields(act)} aria-label={`Move ${name}`} className="flex flex-col gap-2.5 pb-1">
      <input type="hidden" name="scheduleId" value={scheduleId} />
      <input type="hidden" name="dueOn" value={dueOn} />
      <div className="flex flex-col gap-2">
        <span className={fieldLabel}>Move {name} to</span>
        {/* The days after it, then any other; a move is a nudge, so the grid
            stops a month before and three after, as the server does. */}
        <DateChips value={to} onChange={setTo} today={today} from={on > today ? on : today} dir="future"
          min={shiftDay(dueOn, -30)} max={shiftDay(dueOn, 90)} label={`Move ${name} to`} />
        <input type="hidden" name="to" value={to} />
        <span className="text-sm text-muted-foreground">
          {valid ? `${friendlyDay(to, today)} · ${hijri} · ${inWords(today, to)}` : 'Pick a day.'}
        </span>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5">
        <input type="checkbox" name="permanent" value="yes" checked={permanent} disabled={!next}
          onChange={(e) => setPermanent(e.target.checked)}
          className="mt-0.5 size-[22px] flex-none accent-primary" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">
            Make this the day, every {yearly ? 'year' : cal === 'hijri' ? 'Hijri month' : 'month'}
          </span>
          <span className="text-[13px] leading-snug text-muted-foreground">
            {!valid ? ''
              : next
                ? permanent
                  ? `From ${friendlyDate(to)}: ${describeRule(next, cal)}. What is already recorded stays as it is.`
                  : `Otherwise this once only — next time it is back to ${describeRule(rule, cal)}.`
                : `Not every ${cal === 'hijri' ? 'Hijri month' : 'month'} has that day, so it can only move this once.`}
          </span>
        </span>
      </label>

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending || !valid} className={solid}>
          {pending ? 'Moving…' : permanent ? 'Move it, from now on' : 'Move it, this once'}
        </button>
      </div>
    </form>
  );
}

const civil = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
};
