'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '../Icon';
import { ErrorNote as Problem } from '../auth-ui';
import { copyPreviousMonth } from './actions';
import { useMoney } from '@/app/currency';

/* A month with nothing budgeted can start as a copy of the last one that had a budget. Rows the month already has
   are left alone, so it can never overwrite work. The action goes straight into useActionState: it posts as a
   form. */
export default function CopyPrevious({ month, from, total, categories }: {
  month: string; from: string; total: string; categories: number;
}) {
  const { format } = useMoney();
  const [state, act, pending] = useActionState(copyPreviousMonth, null);

  return (
    <form action={act} className="flex flex-col gap-3 rounded-[18px] bg-card p-4">
      <input type="hidden" name="month" value={month} />
      <p className="text-sm leading-relaxed text-muted-foreground">
        {from} came to <b className="font-semibold text-foreground tabular-nums">{format(Number(total))}</b> across{' '}
        {categories} {categories === 1 ? 'category' : 'categories'}.
      </p>
      {state && !state.ok && <Problem>{state.error}</Problem>}
      <Button type="submit" disabled={pending} className="h-12 rounded-xl text-base font-semibold">
        <Icon name="content_copy" size={18} />{pending ? 'Copying…' : `Start from ${from}`}
      </Button>
    </form>
  );
}
