'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../auth-ui';
import { createAccountAndHousehold } from './actions';

export default function SignUpForm() {
  const [state, act, pending] = useActionState(createAccountAndHousehold, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field label="Your name" name="name" autoComplete="name"
        placeholder="Abdeali" required autoFocus />
      <Field label="Email" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required />
      <Field label="Household name" name="household"
        placeholder="Mogul Household" required maxLength={60}
        hint="You can change this later." />
      <Field label="Password" name="password" type="password" autoComplete="new-password"
        required hint="At least 10 characters. A short phrase works well." />
      <Field label="Confirm password" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
