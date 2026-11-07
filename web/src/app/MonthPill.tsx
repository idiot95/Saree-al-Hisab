import Link from '@/app/NavLink';
import { monthKey } from '@/lib/money';
import { Icon } from './Icon';

const shift = (m: string, by: number) => {
  const d = new Date(m);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + by, 1));
};

/* The month a screen is showing, with a step either side. `path` is the screen's own address and `keep` any other
   query it carries (Activity's category filter), so stepping a month never drops what else was chosen. A step is a same-screen change: the
   chevron presses under the finger and the list below the header dims until the month has arrived (pending.ts). */
export default function MonthPill({ month, path, keep = '' }: { month: string; path: string; keep?: string }) {
  const name = new Date(month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  return (
    <div className="flex flex-none items-center rounded-full border border-border bg-card">
      <Link href={`${path}?m=${shift(month, -1)}${keep}`} aria-label="Previous month" className="press grid size-11 place-items-center rounded-full active:bg-muted data-pressed:bg-muted">
        <Icon name="chevron_left" size={18} />
      </Link>
      <span className="min-w-[76px] text-center text-body font-semibold">{name}</span>
      <Link href={`${path}?m=${shift(month, 1)}${keep}`} aria-label="Next month" className="press grid size-11 place-items-center rounded-full active:bg-muted data-pressed:bg-muted">
        <Icon name="chevron_right" size={18} />
      </Link>
    </div>
  );
}
