'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { setNewPassword } from '../actions';
import { cn } from '@/lib/utils';

export default function ResetForm({ token }: { token: string }) {
  const [state, act, pending] = useActionState(setNewPassword, null);

  return (
    <form action={act} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password"
        required autoFocus hint="At least 10 characters." />
      <Field label="Confirm password" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className={cn(primaryBtn, 'mt-1')}>
        {pending ? 'Saving…' : 'Set password'}
      </button>
    </form>
  );
}
