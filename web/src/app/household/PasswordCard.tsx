'use client';

import { useActionState, useState } from 'react';
import { Field, ErrorNote } from '../auth-ui';
import { changeMyPassword } from './actions';

export default function PasswordCard() {
  const [state, act, pending] = useActionState(changeMyPassword, null);
  const [open, setOpen] = useState(false);

  return (
    <section className="el" style={{
      margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} style={{
          minHeight: 48, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
        }}>
          <span style={{
            width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.9} strokeLinecap="round" aria-hidden>
              <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
              <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600 }}>Change your password</span>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-meta)"
            strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </button>
      ) : (
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* The current password is required so that a borrowed unlocked
              phone cannot become a permanent takeover. */}
          <Field label="Current password" name="current" type="password"
            autoComplete="current-password" required autoFocus />
          <Field label="New password" name="next" type="password" autoComplete="new-password"
            required hint="At least 10 characters." />
          <Field label="Confirm new password" name="confirm" type="password"
            autoComplete="new-password" required />

          {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
          {state?.ok && (
            <p role="status" style={{
              margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
              borderRadius: 12, background: 'var(--c-ok-tint)', color: 'var(--c-ok)',
              fontSize: 13.5, fontWeight: 600,
            }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
              {state.message}
            </p>
          )}

          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setOpen(false)} style={{
              minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Cancel</button>
            <button type="submit" disabled={pending} style={{
              flex: 1, minHeight: 48, borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'var(--c-seagrass)', color: 'var(--c-on-fill)',
              opacity: pending ? 0.65 : 1,
            }}>{pending ? 'Saving…' : 'Change password'}</button>
          </div>
        </form>
      )}
    </section>
  );
}
