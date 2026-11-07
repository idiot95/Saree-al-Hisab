import Link from '@/app/NavLink';
import { Progress } from '@/components/ui/progress';
import { Figure } from '../Figure';
import { Icon } from '../Icon';

/* Home's answer to "how is this month going": what is left to spend, large; a bar of how much of the budget has
   gone, with a tick for how far through the month it is, so "am I going too fast" is answered by looking; and
   one status word with its icon. The whole card is the door into Plan (/budget).

   The pace rule is the one Home has always used: ahead when the money is 8 points further through than the
   month. The first week is too early to judge — rent and fees land on the 1st, so on the 2nd a quarter of the
   month's money has gone in two days and every household would be "ahead" — so until the 7th it says so
   instead. The figures are Figure, so they roll after a save, a delete or an Undo, and paint static first. */
export default function LeftToSpend({ month, budget, spent }: { month: string; budget: number; spent: number }) {
  const { day, days, throughMonth, throughMoney, over, status, fill } = paceOf(month, budget, spent);
  return (
    <Link href="/budget" prefetch
      className="press flex flex-col gap-3 rounded-[22px] bg-card p-[18px] text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{over ? 'Over budget by' : 'Left to spend'}</span>
        <span className={`flex items-center gap-1 text-xs font-semibold ${status.tone}`}>
          <Icon name={status.icon} size={16} />{status.word}
        </span>
      </div>
      <Figure minor={Math.abs(budget - spent)} className="text-[40px] font-bold leading-none tracking-tight tabular-nums" />
      <div className="relative py-[3px]">
        <Progress value={Math.min(100, throughMoney * 100)}
          aria-label={`${Math.round(throughMoney * 100)}% of the budget used`}
          className={`h-2.5 bg-muted *:data-[slot=progress-indicator]:rounded-full ${fill}`} />
        {/* How far through the month: the tick the bar is read against. Over budget the bar is full, so the tick turns light to show against it. */}
        <span aria-hidden="true" className={`absolute top-0 h-4 w-0.5 -translate-x-1/2 rounded-full ${over ? 'bg-card' : 'bg-foreground'}`}
          style={{ left: `${throughMonth * 100}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0"><Figure minor={spent} /> spent of <Figure minor={budget} /></span>
        <span className="flex-none">Day {day} of {days}</span>
      </div>
    </Link>
  );
}

/** How the month is going against its budget: how far through the month and the money it is, the one status word
 *  with its icon, and the progress fill that matches. Home's card and Plan's figures both read it, so the two
 *  screens never disagree about the same month. A month already over is judged as at its end. */
export function paceOf(month: string, budget: number, spent: number) {
  const now = new Date();
  const start = new Date(month);
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const sameMonth = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth();
  const day = sameMonth ? now.getDate() : days;
  const throughMonth = day / days;
  const throughMoney = budget > 0 ? spent / budget : 0;
  const over = spent > budget;
  const early = sameMonth && day < 7;
  const fast = !over && throughMoney > throughMonth + 0.08;
  const ahead = fast && !early;

  /* A status carries an icon and a word, never colour alone. */
  const status = over
    ? { word: 'Over budget', icon: 'warning', tone: 'text-destructive' }
    : ahead
      ? { word: 'Ahead of pace', icon: 'trending_up', tone: 'text-attention-soft-foreground' }
      : fast
        ? { word: 'Early days', icon: 'schedule', tone: 'text-muted-foreground' }
        : { word: 'On pace', icon: 'check_circle', tone: 'text-money-in' };
  // Written out whole so Tailwind sees each class.
  const fill = over ? '*:data-[slot=progress-indicator]:bg-destructive'
    : ahead ? '*:data-[slot=progress-indicator]:bg-attention-ink' : '*:data-[slot=progress-indicator]:bg-primary';
  return { day, days, sameMonth, throughMonth, throughMoney, over, status, fill };
}
