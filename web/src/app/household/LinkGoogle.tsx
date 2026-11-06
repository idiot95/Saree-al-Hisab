'use client';

import { useActionState } from 'react';
import { Icon } from '../Icon';
import { ErrorNote } from '../auth-ui';
import { startLinkGoogle } from './actions';

/* Your own account, and how you get into it. Linking is per person: each
   member links their own Google, whatever their role. Once linked, the card
   says so and offers nothing — unlinking is not a thing yet. */
export default function LinkGoogle({ linked }: { linked: boolean }) {
  const [state, act, pending] = useActionState(startLinkGoogle, null);

  return (
    <section className="border border-border" style={{
      margin: '0 var(--gutter) 22px', background: 'var(--card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {linked ? (
        <div style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 11 }}>
          <Glyph name="google" />
          <span style={{ flex: 1, fontSize: 'var(--step-0)', fontWeight: 600 }}>Signed in with Google</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'var(--step--1)',
            fontWeight: 600, color: 'var(--muted-foreground)',
          }}>
            <Icon name="check" size={16} /> Linked
          </span>
        </div>
      ) : (
        /* A real form posting a Server Action, so it works before hydration:
           the action redirects to Google either way. */
        <form action={act}>
          <button type="submit" disabled={pending} style={{
            width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', gap: 11,
            textAlign: 'left', opacity: pending ? 0.65 : 1,
          }}>
            <Glyph name="google" />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
                {pending ? 'Opening Google…' : 'Link Google'}
              </span>
              <span style={{ fontSize: 'var(--step--2)', color: 'var(--muted-foreground)' }}>
                Then sign in with Google instead of your password
              </span>
            </span>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)"
              strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </form>
      )}
      {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
    </section>
  );
}

function Glyph({ name }: { name: string }) {
  return (
    <span style={{
      width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--muted)', color: 'var(--muted-foreground)',
    }}>
      <Icon name={name} size={17} />
    </span>
  );
}
