'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../auth-ui';
import { createFirstOwner } from './actions';

export default function SetupForm() {
  const [state, act, pending] = useActionState(createFirstOwner, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field label="Your name" name="name" autoComplete="name"
        placeholder="Abdeali" required autoFocus />
      <Field label="Email" name="email" type="email" inputMode="email"
        autoComplete="username" placeholder="you@example.com" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password"
        required hint="At least 10 characters. Three ordinary words beat one clever one — nobody has to send this anywhere, so make it long rather than fiddly." />
      <Field label="Password again" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Setting up…' : 'Claim the books'}
      </button>
    </form>
  );
}
