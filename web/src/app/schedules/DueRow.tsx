'use client';

import { useActionState, useCallback, useState, useTransition } from 'react';
import { Icon } from '../Icon';
import SwipeRow from '../SwipeRow';
import { recordDue, skipDue } from './actions';
import MoveDue from './MoveDue';
import { friendlyDay, type Calendar } from '@/lib/recur';
import { useMoney } from '@/app/currency';

export default function DueRow({
  scheduleId, name, kind = 'expense', dueOn, on = dueOn, movedFrom, daysAway, amount, category,
  icon, rule, cal = 'gregorian', today, canRecord = true,
}: {
  scheduleId: string; name: string; kind?: 'expense' | 'income';
  /** The rule's date — what the occurrence is keyed by. */
  dueOn: string;
  /** The day it is expected: the same, unless it was moved. */
  on?: string; movedFrom?: string;
  daysAway: number;
  amount: number; category: string | null; icon?: string | null;
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
    <div className="flex flex-col gap-2.5 border-b border-border py-2.5 last:border-b-0">
      <SwipeRow actions={open ? [] : [
        { label: 'Skip', icon: <Icon name="skip" size={20} />, act: skipNow },
        ...(canMove ? [{ label: 'Move', icon: <Icon name="move" size={20} />,
          act: () => setMode('move') }] : []),
        ...(canRecord ? [{ label: income ? 'Came in' : 'Record', tone: 'primary' as const,
          icon: <Icon name="check" size={20} />, act: () => setMode('record') }] : []),
      ]}>
      <div className="flex min-h-[52px] items-center gap-3">
        <span className={`grid size-10 flex-none place-items-center rounded-xl ${overdue
          ? 'bg-destructive/10 text-destructive' : 'bg-attention-soft text-attention-soft-foreground'}`}>
          <Icon name={icon ?? 'autodebit'} size={20} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium [overflow-wrap:anywhere]">{name}</span>
          <span className={`text-xs [overflow-wrap:anywhere] ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
            {whenLine(income, on, daysAway, today)}
            {movedFrom && ` · moved from ${friendlyDay(movedFrom, today)}`}
            {category && ` · ${category}`}
          </span>
        </span>
        <span className={`flex-none text-[15px] font-semibold tabular-nums ${income ? 'text-money-in' : ''}`}>
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
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Amount — change it if this month differed</span>
            <input name="amount" inputMode="decimal" defaultValue={toKeys(amount)}
              className="min-h-12 rounded-xl border border-input bg-card px-3 font-semibold text-foreground" />
          </label>
          {recState && !recState.ok && (
            <span role="alert" className="flex items-center gap-1.5 text-sm text-destructive"><Icon name="error" size={18} />{recState.error}</span>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={idle}
              className="press min-h-12 rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground">Cancel</button>
            <button type="submit" disabled={recording}
              className="press min-h-12 flex-1 rounded-xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-60">
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
