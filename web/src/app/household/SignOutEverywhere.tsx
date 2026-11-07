'use client';

import { useActionState, useState } from 'react';
import { signOutEverywhere } from './actions';
import { ErrorNote } from '../auth-ui';
import { Chevron, danger, ghost, Glyph, row, Words } from './rows';

export default function SignOutEverywhere() {
  const [state, act, pending] = useActionState(signOutEverywhere, null);
  const [sure, setSure] = useState(false);

  if (!sure) {
    return (
      <button type="button" onClick={() => setSure(true)} className={row}>
        <Glyph name="devices" />
        <Words title="Sign out everywhere" sub="Every phone, this one included" />
        <Chevron />
      </button>
    );
  }
  return (
    <form action={act} className="flex flex-col gap-3 px-[var(--pad)] py-4">
      <div className="flex items-center gap-3">
        <Glyph name="devices" />
        <Words title="Sign out everywhere" />
      </div>
      <p className="text-subhead leading-normal text-muted-foreground">
        Ends every signed-in session on every device, including this one. Use this if a
        phone has been lost or you think someone else has your password.
      </p>
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setSure(false)} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending} className={`${danger} flex-1`}>
          {pending ? 'Signing out…' : 'Sign out everywhere'}
        </button>
      </div>
    </form>
  );
}
