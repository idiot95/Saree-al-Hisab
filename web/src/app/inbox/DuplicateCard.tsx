'use client';

import Link from '@/app/NavLink';
import { useActionState } from 'react';
import { notDuplicate, dropDuplicate } from './actions';
import { useMoney } from '@/app/currency';
import { Icon } from '../Icon';

type Side = {
  id: string; amount: string; on: string; merchant: string | null;
  who: string; account: string; category: string | null;
};

/* The two sides are shown whole, one under the other, because the decision cannot be made from a summary: what
   differs between them IS the question. Rule B in particular flags entries on different accounts, which is exactly
   the case where the pair looks least alike and is most likely to be one purchase. Real forms posting to the
   actions, so Delete and "both real" work before the script has arrived. */
export default function DuplicateCard({ low, high, reason, canWrite = true }: {
  low: Side; high: Side; reason: 'same_account' | 'two_people'; canWrite?: boolean;
}) {
  const { format } = useMoney();
  const [keepState, keep, keeping] = useActionState(notDuplicate, null);
  const [dropState, drop, dropping] = useActionState(dropDuplicate, null);
  const err = (keepState && !keepState.ok && keepState.error)
    || (dropState && !dropState.ok && dropState.error);

  return (
    <article className="flex flex-col gap-3 rounded-[18px] bg-card p-4">
      <p className="flex items-center gap-1.5 self-start rounded-lg bg-attention-soft px-2.5 py-1 text-xs font-semibold text-attention-soft-foreground">
        <Icon name="content_copy" size={15} /> Possibly the same thing
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {reason === 'two_people'
          ? `${low.who} and ${high.who} each recorded this. The accounts differ, which is usually the sign of one purchase entered twice rather than two purchases.`
          : 'The same amount, on the same account, within three days.'}
      </p>

      <ul className="flex flex-col gap-2">
        {[low, high].map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-[14px] border border-border bg-background py-1 pl-3 pr-1.5">
            <Link transitionTypes={['nav-forward']} href={`/entries/${s.id}`}
              className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5 text-foreground">
              <span className="text-[15px] font-medium [overflow-wrap:anywhere]">{s.merchant || s.category || 'Entry'}</span>
              <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {new Date(s.on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {' · '}{s.account}{' · '}{s.who}
              </span>
            </Link>
            <span className="flex-none text-[15px] font-semibold tabular-nums">{format(Number(s.amount))}</span>
            {canWrite && (
              <form action={drop} className="flex-none">
                <input type="hidden" name="txnId" value={s.id} />
                <button type="submit" disabled={dropping} aria-label={`Delete ${s.merchant || s.category || 'entry'}, ${new Date(s.on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  className="press flex min-h-11 items-center gap-1 rounded-xl bg-destructive/10 px-3 text-sm font-semibold text-destructive disabled:opacity-60 in-data-[platform=android]:min-h-12">
                  <Icon name="delete" size={18} /> Delete
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {err && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-destructive"><Icon name="error" size={18} />{err}</p>
      )}

      {canWrite && (
        <form action={keep}>
          <input type="hidden" name="lowId" value={low.id} />
          <input type="hidden" name="highId" value={high.id} />
          <button type="submit" disabled={keeping}
            className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-muted text-[15px] font-semibold text-foreground disabled:opacity-60">
            <Icon name="done_all" size={20} />{keeping ? 'Saving…' : 'They are both real — keep them'}
          </button>
        </form>
      )}
    </article>
  );
}
