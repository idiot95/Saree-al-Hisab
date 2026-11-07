import Link from '@/app/NavLink';
import { Icon } from '../Icon';
import { liRule } from '../form-bits';
import type { HoldingItem } from './types';

/* One pot or one metal: what it is, whose it is and how much of it, and what it is worth in the household's
   currency. A holding with no rate yet shows its own amount and says so — "not valued yet" must never read as
   "worth nothing". Static figures: a list is not a place for digits to roll. */
export default function HoldingRow({ h, value }: { h: HoldingItem; value: string | null }) {
  /* Unvalued, the own amount moves to the right where the value would be, so it is not said twice. */
  const amount = value === null ? [] : [h.native];
  const sub = [h.ownerName, ...amount, ...(h.kind === 'metal' ? [h.badge] : [])].join(' · ');
  return (
    <li className={`${liRule} [--rule-x:66px]`}>
      <Link href={`/worth/${h.id}`}
        className="press flex min-h-16 items-center gap-3 px-3.5 py-2.5">
        {h.kind === 'fx_cash' ? (
          <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-accent text-footnote font-bold text-accent-foreground">
            {h.badge}
          </span>
        ) : (
          <span className="grid size-10 flex-none place-items-center rounded-[12px] bg-attention-soft text-attention-soft-foreground">
            <Icon name="diamond" size={20} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-medium [overflow-wrap:anywhere]">{h.name}</span>
          <span className="text-footnote text-muted-foreground [overflow-wrap:anywhere]">{sub}</span>
        </span>
        {value !== null ? (
          <span className="flex flex-none items-center gap-1 text-body font-semibold tabular-nums">
            {/* The section above says which rate and from when; the row carries its own mark of it. */}
            {h.stale && <Icon name="sync_problem" size={15} aria-label="Older rate" className="text-attention-soft-foreground" />}
            {value}
          </span>
        ) : (
          <span className="flex flex-none flex-col items-end gap-0.5">
            <span className="text-body font-semibold tabular-nums">{h.native}</span>
            <span className="flex items-center gap-1 text-footnote text-muted-foreground">
              <Icon name="info" size={14} />Not valued yet
            </span>
          </span>
        )}
        <Icon name="chevron_right" size={18} className="text-muted-foreground" />
      </Link>
    </li>
  );
}
