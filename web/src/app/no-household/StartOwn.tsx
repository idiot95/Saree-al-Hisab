'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote, primaryBtn, quietBtn } from '../auth-ui';
import { startYourOwnBooks } from './actions';

export default function StartOwn() {
  const [state, act, pending] = useActionState(startYourOwnBooks, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{ ...quietBtn, marginTop: 4 }}>
        Start my own household
      </button>
    );
  }
  return (
    <form action={act} style={{
      display: 'flex', flexDirection: 'column', gap: 12, width: '100%',
      maxWidth: 360, textAlign: 'left', marginTop: 4,
    }}>
      <Field label="Household name" name="name" placeholder="Home"
        required maxLength={60} autoFocus />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1 }}>
        {pending ? 'Creating…' : 'Create household'}
      </button>
    </form>
  );
}
