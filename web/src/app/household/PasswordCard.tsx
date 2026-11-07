'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { changeMyPassword } from './actions';
import { Chevron, Done, ghost, Glyph, row, solid, Words } from './rows';

/* A row in Your account; tapped, it opens the form in place. */
export default function PasswordCard() {
  const [state, act, pending] = useActionState(changeMyPassword, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={row}>
        <Glyph name="lock" />
        <Words title="Change your password" />
        <Chevron />
      </button>
    );
  }
  return (
    <form action={act} className="flex flex-col gap-3 px-[var(--pad)] py-4">
      <div className="flex items-center gap-3">
        <Glyph name="lock" />
        <Words title="Change your password" />
      </div>
      {/* The current password is required so that a borrowed unlocked
          phone cannot become a permanent takeover. */}
      <Field label="Current password" name="current" type="password"
        autoComplete="current-password" required autoFocus />
      <Field label="New password" name="next" type="password" autoComplete="new-password"
        required hint="At least 10 characters." />
      <Field label="Confirm new password" name="confirm" type="password"
        autoComplete="new-password" required />

      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      {state?.ok && <Done>{state.message}</Done>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className={ghost}>Cancel</button>
        <button type="submit" disabled={pending} className={solid}>{pending ? 'Saving…' : 'Change password'}</button>
      </div>
    </form>
  );
}
