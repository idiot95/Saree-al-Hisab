'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, quietBtn } from '../auth-ui';
import { signInWithPassword } from './actions';
import { cn } from '@/lib/utils';

export default function SignInForm() {
  const [state, act, pending] = useActionState(signInWithPassword, null);

  return (
    <form action={act} className="flex flex-col gap-3">
      <Field
        label="Email" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required
      />
      <Field
        label="Password" name="password" type="password"
        autoComplete="current-password" required
      />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className={cn(quietBtn, 'mt-1')}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
