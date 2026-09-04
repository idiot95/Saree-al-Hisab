'use client';

import { useActionState } from 'react';
import { Field, ErrorNote, primaryBtn } from '../../auth-ui';
import { setNewPassword } from '../actions';

export default function ResetForm({ token }: { token: string }) {
  const [state, act, pending] = useActionState(setNewPassword, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <input type="hidden" name="token" value={token} />
      <Field label="New password" name="password" type="password" autoComplete="new-password"
        required autoFocus hint="At least 10 characters." />
      <Field label="Confirm password" name="confirm" type="password"
        autoComplete="new-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Saving…' : 'Set password'}
      </button>
    </form>
  );
}
