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
        Fine — start my own
      </button>
    );
  }
  return (
    <form action={act} style={{
      display: 'flex', flexDirection: 'column', gap: 12, width: '100%',
      maxWidth: 360, textAlign: 'left', marginTop: 4,
    }}>
      <Field label="What to call your books" name="name" placeholder="Home"
        required maxLength={60} autoFocus
        hint="Entirely yours. Nothing from anyone else’s books comes with you." />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1 }}>
        {pending ? 'Ruling the columns…' : 'Open them'}
      </button>
    </form>
  );
}
