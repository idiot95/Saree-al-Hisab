'use client';

import { useActionState } from 'react';
import { CurrencyField, Field, ErrorNote, primaryBtn } from '../auth-ui';
import { setUpHousehold } from './actions';
import { useKeepOnRefusal } from '../form-hooks';
import { cn } from '@/lib/utils';

export default function SetupForm() {
  const [state, act, pending] = useActionState(setUpHousehold, null);
  // Posts directly; a refusal's form reset is undone so the currency picked stays.
  const keep = useKeepOnRefusal(state);

  return (
    <form action={act} {...keep} className="flex flex-col gap-3">
      <Field label="Household name" name="name" placeholder="Mogul Household"
        required maxLength={60} autoFocus hint="You can rename it later." />
      <CurrencyField
        hint="Every entry is recorded in this. You can change it until the first one." />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <button type="submit" disabled={pending} className={cn(primaryBtn, 'mt-1')}>
        {pending ? 'Opening the books…' : 'Open the books'}
      </button>
    </form>
  );
}
