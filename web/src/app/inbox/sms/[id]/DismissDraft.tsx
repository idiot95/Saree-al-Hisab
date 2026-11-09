'use client';

import { useActionState } from 'react';
import { dismissDraft, type Result } from '../../actions';
import { Icon } from '../../../Icon';

/* Dismiss from the message's own screen; the action sends the person back to Activity › From SMS. */
export default function DismissDraft({ id }: { id: string }) {
  const [state, act, pending] = useActionState<Result | null, FormData>(dismissDraft, null);
  return (
    <form action={act} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="then" value="inbox" />
      <button type="submit" disabled={pending}
        className="press flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card text-headline font-semibold">
        <Icon name="close" size={20} /> Dismiss
      </button>
      {state && !state.ok && (
        <p role="alert" className="flex items-center gap-1.5 text-body text-destructive"><Icon name="error" size={18} />{state.error}</p>
      )}
    </form>
  );
}
