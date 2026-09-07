'use client';

import { useActionState } from 'react';
import { CurrencyField, Field, ErrorNote, primaryBtn } from '../auth-ui';
import { setUpHousehold } from './actions';

export default function SetupForm() {
  const [state, act, pending] = useActionState(setUpHousehold, null);

  return (
    <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <Field label="Household name" name="name" placeholder="Mogul Household"
        required maxLength={60} autoFocus hint="You can rename it later." />
      <CurrencyField
        hint="Every entry is recorded in this. You can change it until the first one." />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className="el2"
        style={{ ...primaryBtn, opacity: pending ? 0.65 : 1, marginTop: 3 }}>
        {pending ? 'Opening the books…' : 'Open the books'}
      </button>
    </form>
  );
}
