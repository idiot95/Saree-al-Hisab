'use client';

import { useActionState } from 'react';
import { revokeInvite } from './actions';

export default function RevokeButton({ id }: { id: string }) {
  const [state, act, pending] = useActionState(revokeInvite, null);

  return (
    <form action={act} className="flex-none">
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} title={state && !state.ok ? state.error : undefined}
        className="press flex min-h-11 items-center rounded-xl bg-muted px-3 text-sm font-semibold text-destructive disabled:opacity-60 in-data-[platform=android]:min-h-12">
        {pending ? 'Withdrawing…' : 'Withdraw'}
      </button>
    </form>
  );
}
