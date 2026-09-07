'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../auth-ui';
import { createYourAccount } from './actions';

export default function SignUpForm() {
  const [state, act, pending] = useActionState(createYourAccount, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field label="Your name" name="name" autoComplete="name"
        placeholder="Abdeali" required autoFocus />
      <Field label="Email" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password"
        required hint="At least 10 characters. A short phrase works well." />
      <Field label="Confirm password" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Creating…' : 'Continue'}
      </button>
      <p style={{ margin: '2px 4px 0', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
        Continuing means agreeing to the{' '}
        <a href="/terms" style={{ color: 'var(--c-teal)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
          terms, and how your data is kept
        </a>. Short, and every line of it can be checked.
      </p>
    </form>
  );
}
