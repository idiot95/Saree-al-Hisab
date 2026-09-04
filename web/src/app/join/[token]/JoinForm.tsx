'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { joinWithNewAccount } from '../actions';

export default function JoinForm({ token, email }: { token: string; email: string }) {
  const [state, act, pending] = useActionState(joinWithNewAccount, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <input type="hidden" name="token" value={token} />
      {/* Fixed, not chosen: this is the address the invitation was written to. */}
      <Field label="Email" name="shown" type="email" value={email} readOnly disabled
        style={{
          minHeight: 52, borderRadius: 13, border: '1px solid var(--c-border)',
          background: 'var(--c-sunk)', color: 'var(--c-meta)', fontSize: 16,
          padding: '0 14px', width: '100%',
        }} />
      <Field label="Your name" name="name" autoComplete="name"
        placeholder="What the household should call you" required autoFocus />
      <Field label="Choose a password" name="password" type="password"
        autoComplete="new-password" required
        hint="At least 10 characters. Three ordinary words beat one clever one." />
      <Field label="Password again" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Joining…' : 'Join the household'}
      </button>
    </form>
  );
}
