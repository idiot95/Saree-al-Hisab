import Link from '@/app/NavLink';

/* Quiet Ledger's one way of saying "these are views of the same thing": a segmented row of links at the top of a
   tab — Entries · To review · Upcoming under Activity, Budget · Trends under Plan. Real links, so each view has
   its own address and the back button works; the lit one carries aria-current. */
export type Segment = { key: string; href: string; label: string; count?: number };

export default function Segments({ label, items, current }: { label: string; items: Segment[]; current: string }) {
  return (
    <nav aria-label={label} className="grid gap-1 rounded-[14px] bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((i) => {
        const on = i.key === current;
        return (
          <Link key={i.key} href={i.href} transitionTypes={['nav-lateral']} aria-current={on ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[11px] text-sm font-semibold ${on
              ? 'bg-card text-foreground shadow-[0_1px_3px_rgba(29,42,46,.12)]' : 'text-muted-foreground'}`}>
            {i.label}
            {!!i.count && i.count > 0 && (
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
