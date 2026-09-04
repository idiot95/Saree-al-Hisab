'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { setNewPassword } from '../actions';

export default function ResetForm({ token }: { token: string }) {
  const [state, act, pending] = useActionState(setNewPassword, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <input type="hidden" name="token" value={token} />
      <Field label="The new password" name="password" type="password" autoComplete="new-password"
        required autoFocus hint="Ten characters minimum. Three boring words beat one clever one — and this time write it down somewhere sensible." />
      <Field label="Once more, with feeling" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Saving…' : 'Set it and let me in'}
      </button>
    </form>
  );
}
