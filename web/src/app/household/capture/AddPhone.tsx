'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Icon } from '../../Icon';
import { keepFields } from '../../worth/fields';
import { addPhone, type AddResult } from './actions';
import Copy from './Copy';

/* "Add a phone": a name, then the key — shown here once and never again, with what to paste where. */
export default function AddPhone({ endpoint }: { endpoint: string }) {
  const [state, act, pending] = useActionState<AddResult, FormData>(addPhone, null);
  /* The key is taken off the screen when the page is left, so the back button (and the back-forward cache) never
     shows it again; the page itself is sent no-store. A new key, from a new submission, shows as usual. */
  const [hidden, setHidden] = useState<AddResult>(null);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  useEffect(() => {
    const hide = () => setHidden(latest.current);
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, []);
  const shown = state?.ok && state !== hidden ? state : null;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <form noValidate onSubmit={keepFields(act)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Which phone is this?</span>
          <input name="label" required maxLength={40} autoComplete="off" placeholder="For example: Ammar’s iPhone"
            className="min-h-12 w-full rounded-xl border border-border bg-background px-3.5 text-[length:var(--field)] text-foreground" />
        </label>
        <button type="submit" disabled={pending}
          className="press flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
          <Icon name="add" size={20} /> {pending ? 'Adding…' : 'Add a phone'}
        </button>
        {state && !state.ok && (
          <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <Icon name="error" size={18} />{state.error}
          </p>
        )}
      </form>

      {shown && (
        <section aria-label={`Key for ${shown.label}`} className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Icon name="check_circle" size={18} className="text-money-in" /> {shown.label} added
          </p>
          <p className="flex items-start gap-2 rounded-xl bg-attention-soft px-3 py-2.5 text-sm leading-relaxed text-attention-soft-foreground">
            <Icon name="warning" size={18} />
            <span><b className="font-semibold">Anyone with this can add drafts to your books. It won’t be shown again.</b> Paste it
              into the phone now, then leave this screen.</span>
          </p>
          <Copy label="Key" value={shown.token} />
          <Copy label="Address" value={endpoint} />
          <Copy label="Authorization header" value={`Bearer ${shown.token}`} />
        </section>
      )}
    </div>
  );
}
