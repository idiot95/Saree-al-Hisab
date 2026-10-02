import Link from '@/app/NavLink';

/* Activity is three views of the same books: what happened (entries), what wants a decision (the inbox), and what
   comes round next (schedules). One segmented control at the top of each, so they read as one tab. */
export default function ActivityNav({ current, review = 0 }: { current: 'entries' | 'inbox' | 'schedules'; review?: number }) {
  const items = [
    { key: 'entries', href: '/entries', label: 'Entries' },
    { key: 'inbox', href: '/inbox', label: 'To review', count: review },
    { key: 'schedules', href: '/schedules', label: 'Upcoming' },
  ] as const;
  return (
    <nav aria-label="Activity" className="grid grid-cols-3 gap-1 rounded-[14px] bg-muted p-1">
      {items.map((i) => {
        const on = i.key === current;
        return (
          <Link key={i.key} href={i.href} transitionTypes={['nav-lateral']} aria-current={on ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] text-sm font-semibold ${on
              ? 'bg-card text-foreground shadow-[0_1px_3px_rgba(29,42,46,.12)]' : 'text-muted-foreground'}`}>
            {i.label}
            {'count' in i && i.count > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-attention px-1.5 text-[11px] font-bold leading-5 text-attention-foreground">
                {i.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
