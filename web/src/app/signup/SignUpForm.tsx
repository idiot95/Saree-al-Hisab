'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../auth-ui';
import { createAccountAndHousehold } from './actions';

export default function SignUpForm() {
  const [state, act, pending] = useActionState(createAccountAndHousehold, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field label="What you go by" name="name" autoComplete="name"
        placeholder="Abdeali" required autoFocus />
      <Field label="Email — also your way back in" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required />
      <Field label="What to call these books" name="household"
        placeholder="Mogul Household" required maxLength={60}
        hint="Yours to rename later, when “Home” starts feeling optimistic." />
      <Field label="Password" name="password" type="password" autoComplete="new-password"
        required hint="Ten characters at least. Three boring words beat one clever one, and you might even remember it." />
      <Field label="Password, again, for luck" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Ruling the columns…' : 'Open the books'}
      </button>
    </form>
  );
}
