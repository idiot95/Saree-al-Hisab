import { IconAlertTriangle, IconCircleCheck, IconTrendingUp } from '@tabler/icons-react';
import { format } from '@/lib/money';

/* Quiet Ledger's answer to "how is this month going": what is left to spend, large, beside a ring of how much of
   the budget has gone. A tick on the ring marks how far through the month it is, so "am I going too fast" is
   answered by looking — the same pace rule as before (ahead when the money is 8 points further through than the
   month). Server-only markup: no script, so it paints with the first byte. */
export default function MonthRing({ month, budget, spent }: { month: string; budget: number; spent: number }) {
  const now = new Date();
  const start = new Date(month);
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const sameMonth = now.getFullYear() === start.getFullYear() && now.getMonth() === start.getMonth();
  const dayOfMonth = sameMonth ? now.getDate() : days;
  const throughMonth = dayOfMonth / days;
  const throughMoney = budget > 0 ? spent / budget : 0;
  const over = spent > budget;
  const ahead = !over && throughMoney > throughMonth + 0.08;
  const left = budget - spent;
  const daysLeft = Math.max(0, days - dayOfMonth);

  const r = 40, c = 2 * Math.PI * r;
  const used = Math.min(1, throughMoney);
  const tick = throughMonth * 2 * Math.PI - Math.PI / 2;
  const tone = over ? 'var(--destructive)' : ahead ? 'var(--attention)' : 'var(--primary)';

  return (
    <section aria-label="This month" className="rounded-[22px] border border-border bg-card p-4 text-card-foreground">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-4">
        <svg viewBox="0 0 100 100" className="size-24" role="img"
          aria-label={`${Math.round(throughMoney * 100)}% of the budget used, ${Math.round(throughMonth * 100)}% of the month gone`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${used * c} ${c}`} transform="rotate(-90 50 50)" />
          <line x1={50 + 31 * Math.cos(tick)} y1={50 + 31 * Math.sin(tick)} x2={50 + 49 * Math.cos(tick)} y2={50 + 49 * Math.sin(tick)}
            stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
          <text x="50" y="55" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)">
            {Math.round(throughMoney * 100)}%
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{over ? 'Over budget by' : 'Left to spend'}</p>
          <p className="font-display text-[40px] leading-none tabular-nums">{format(Math.abs(left))}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {format(spent)} of {format(budget)} · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
          </p>
        </div>
      </div>
      {/* A status carries an icon and a word, never colour alone. */}
      <p className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm"
        style={{ color: over ? 'var(--destructive)' : ahead ? 'var(--attention-soft-foreground)' : 'var(--muted-foreground)' }}>
        {over ? <IconAlertTriangle size={17} aria-hidden /> : ahead ? <IconTrendingUp size={17} aria-hidden /> : <IconCircleCheck size={17} aria-hidden />}
        {over ? 'Over the budget for the month.' : ahead ? 'Going a little fast for this point in the month.' : 'On pace for the month.'}
      </p>
    </section>
  );
}
