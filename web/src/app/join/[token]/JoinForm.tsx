'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { joinWithNewAccount } from '../actions';
import { cn } from '@/lib/utils';

export default function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, act, pending] = useActionState(joinWithNewAccount, null);

  return (
    <form action={act} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      {/* Fixed, not chosen: this is the address the invitation was written to. */}
      <Field label="Email" name="shown" type="email" value={email} readOnly disabled
        className="bg-muted text-muted-foreground disabled:opacity-100 dark:bg-muted" />
      <Field label="Your name" name="name" autoComplete="name"
        placeholder="Fatema" required autoFocus />
      <Field label="Password" name="password" type="password"
        autoComplete="new-password" required
        hint="At least 10 characters. A short phrase works well." />
      <Field label="Confirm password" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className={cn(primaryBtn, 'mt-1')}>
        {pending ? 'Joining…' : 'Join household'}
      </button>
    </form>
  );
}
