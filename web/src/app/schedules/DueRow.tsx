'use client';

import { useActionState, useCallback, useState, useTransition } from 'react';
import { Chip, Icon } from '../Icon';
import SwipeRow from '../SwipeRow';
import { recordDue, skipDue } from './actions';
import MoveDue from './MoveDue';
import { ErrorNote, Field } from '../auth-ui';
import { ghost, solid, rowRule, rulePad } from '../form-bits';
import { friendlyDay, type Calendar } from '@/lib/recur';
import { useMoney } from '@/app/currency';

export default function DueRow({
  scheduleId, name, kind = 'expense', dueOn, on = dueOn, movedFrom, daysAway, amount, category,
  icon, tint, rule, cal = 'gregorian', today, canRecord = true,
}: {
  scheduleId: string; name: string; kind?: 'expense' | 'income';
  /** The rule's date — what the occurrence is keyed by. */
  dueOn: string;
  /** The day it is expected: the same, unless it was moved. */
  on?: string; movedFrom?: string;
  daysAway: number;
  amount: number; category: string | null; icon?: string | null;
  /** The category's tint: a due wears the same chip as the payment does in every other list. */
  tint?: string | null;
  /** With the rule and today's date the row can offer to move the due. */
  rule?: string; cal?: Calendar; today?: string;
  /** A due months away can be moved or skipped, but not recorded yet. */
  canRecord?: boolean;
}) {
  const { format, toKeys } = useMoney();
  const income = kind === 'income';
  const [recState, record, recording] = useActionState(recordDue, null);
  const [, skip] = useActionState(skipDue, null);
  const [mode, setMode] = useState<'idle' | 'record' | 'move'>('idle');
  const open = mode !== 'idle';
  const idle = useCallback(() => setMode('idle'), []);
  const [, start] = useTransition();
  const overdue = daysAway < 0;
  const canMove = !!rule && !!today;

  /* Everything the row can do is in the swipe — Skip, Move, Record — with
     the grip at the edge as the tell and the twin. A short swipe shows them,
     all the way across opens the amount to record it. */
  const skipNow = () => start(() => {
    const fd = new FormData();
    fd.append('scheduleId', scheduleId); fd.append('dueOn', dueOn);
    skip(fd);
  });

  return (
    <div className={`relative flex flex-col gap-2.5 py-2.5 ${rowRule} ${rulePad} last:after:hidden`}>
      <SwipeRow actions={open ? [] : [
        { label: 'Skip', icon: <Icon name="skip" size={20} />, act: skipNow },
        ...(canMove ? [{ label: 'Move', icon: <Icon name="move" size={20} />,
          act: () => setMode('move') }] : []),
        ...(canRecord ? [{ label: income ? 'Came in' : 'Record', tone: 'primary' as const,
          icon: <Icon name="check" size={20} />, act: () => setMode('record') }] : []),
      ]}>
      <div className="flex min-h-[52px] items-center gap-3">
        {/* The payment's own chip, as under Every regular payment; whether it is late is said in the line under its
            name, with an icon and the word (ux-audit O5). */}
        <Chip icon={icon ?? 'autodebit'} tint={tint} size={40} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium [overflow-wrap:anywhere]">{name}</span>
          <span className={`text-footnote [overflow-wrap:anywhere] ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
            {overdue && <Icon name="warning" size={13} className="mr-1 align-[-2px]" />}
            {whenLine(income, on, daysAway, today)}
            {movedFrom && ` · moved from ${friendlyDay(movedFrom, today)}`}
            {category && ` · ${category}`}
          </span>
        </span>
        <span className={`flex-none text-body font-semibold tabular-nums ${income ? 'text-money-in' : ''}`}>
          {income ? '+' : ''}{format(amount)}
        </span>
      </div>
      </SwipeRow>

      {mode === 'idle' ? null : mode === 'move' ? (
        <MoveDue scheduleId={scheduleId} name={name} dueOn={dueOn} on={on}
          rule={rule!} cal={cal} today={today!} onDone={idle} onCancel={idle} />
      ) : (
        <form action={record} className="flex flex-col gap-2 pb-1">
          <input type="hidden" name="scheduleId" value={scheduleId} />
          <input type="hidden" name="dueOn" value={dueOn} />
          <Field label="Amount — change it if this month differed" name="amount" inputMode="decimal"
            defaultValue={toKeys(amount)} />
          {recState && !recState.ok && <ErrorNote>{recState.error}</ErrorNote>}
          <div className="flex gap-2">
            <button type="button" onClick={idle} className={ghost}>Cancel</button>
            <button type="submit" disabled={recording} className={solid}>
              {recording ? 'Saving…' : income ? 'Record that it came in' : 'Record the payment'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* "Due Sat 12 Sep · in 4 days": the day first, in words a person uses, and
   the distance after it. Today and tomorrow need no date; a day gone says
   how far gone. Income is expected, not due. */
function whenLine(income: boolean, on: string, daysAway: number, today?: string) {
  const verb = income ? 'Expected' : 'Due';
  if (daysAway === 0) return `${verb} today`;
  if (daysAway === 1) return `${verb} tomorrow`;
  if (daysAway === -1) return `${verb} yesterday · ${income ? 'not yet' : 'overdue'}`;
  const day = friendlyDay(on, today);
  return daysAway > 0
    ? `${verb} ${day} · in ${daysAway} days`
    : `${verb} ${day} · ${-daysAway} days ${income ? 'ago' : 'overdue'}`;
}
