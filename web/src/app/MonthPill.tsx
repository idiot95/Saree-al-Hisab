import Link from '@/app/NavLink';
import { monthKey } from '@/lib/money';
import { Icon } from './Icon';
import { monthPill, monthStep } from './form-bits';

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
    <div className={monthPill}>
      <Link href={`${path}?m=${shift(month, -1)}${keep}`} aria-label="Previous month" className={STEP}>
        <Icon name="chevron_left" size={18} />
      </Link>
      <span className="min-w-[68px] text-center text-subhead font-semibold">{name}</span>
      <Link href={`${path}?m=${shift(month, 1)}${keep}`} aria-label="Next month" className={STEP}>
        <Icon name="chevron_right" size={18} />
      </Link>
    </div>
  );
}

/* The chips' height, 32px drawn, so the pill and the chip row under it read as one family; each arrow's target is
   44px (48 on Android) through the same invisible ::after as a chip (form-bits). */
const STEP = `press relative ${monthStep} rounded-full transition-colors active:bg-muted data-pressed:bg-muted after:absolute after:-inset-x-0.5 after:-inset-y-[7px] after:content-[''] in-data-[platform=android]:after:-inset-y-[9px]`;
