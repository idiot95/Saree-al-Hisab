'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../auth-ui';
import { signInWithPassword } from './actions';

export default function SignInForm() {
  const [state, act, pending] = useActionState(signInWithPassword, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field
        label="Email" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required autoFocus
      />
      <Field
        label="Password" name="password" type="password"
        autoComplete="current-password" required
      />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
