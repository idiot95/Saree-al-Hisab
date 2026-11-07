'use client';

import { useActionState } from 'react';
import { Icon } from '../Icon';
import { ErrorNote } from '../auth-ui';
import { startLinkGoogle } from './actions';
import { Chevron, Glyph, row, Words } from './rows';

/* Your own account, and how you get into it. Linking is per person: each
   member links their own Google, whatever their role. Once linked, the row
   says so and offers nothing — unlinking is not a thing yet. */
export default function LinkGoogle({ linked }: { linked: boolean }) {
  const [state, act, pending] = useActionState(startLinkGoogle, null);

  if (linked) {
    return (
      <div className="flex min-h-14 items-center gap-3 px-[var(--pad)] py-2.5">
        <Glyph name="google" tone="accent" />
        <Words title="Signed in with Google" />
        <span className="inline-flex flex-none items-center gap-1 text-subhead font-semibold text-muted-foreground">
          <Icon name="check" size={16} /> Linked
        </span>
      </div>
    );
  }
  return (
    /* A real form posting a Server Action, so it works before hydration:
       the action redirects to Google either way. */
    <form action={act}>
      <button type="submit" disabled={pending} className={row}>
        <Glyph name="google" />
        <Words title={pending ? 'Opening Google…' : 'Link Google'}
          sub="Then sign in with Google instead of your password" />
        <Chevron />
      </button>
      {state && !state.ok && <div className="px-[var(--pad)] pb-3"><ErrorNote>{state.error}</ErrorNote></div>}
    </form>
  );
}
