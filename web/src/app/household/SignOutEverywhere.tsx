'use client';

import { useActionState, useState } from 'react';
import { signOutEverywhere } from './actions';

export default function SignOutEverywhere() {
  const [state, act, pending] = useActionState(signOutEverywhere, null);
  const [sure, setSure] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      {!sure ? (
        <button type="button" onClick={() => setSure(true)} style={{
          minHeight: 48, display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
        }}>
          <span style={{
            width: 38, height: 38, flex: 'none', borderRadius: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 16.5 19.5 12 15 7.5" /><path d="M19 12H9" />
              <path d="M12 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H12" />
            </svg>
          </span>
          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 600 }}>Sign out everywhere</span>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="var(--c-meta)"
            strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M9 5l7 7-7 7" /></svg>
        </button>
      ) : (
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            Ends every signed-in session on every device, including this one. Use this if a
            phone has been lost or you think someone else has your password.
          </p>
          {state && !state.ok && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--c-danger)' }}>{state.error}</p>
          )}
          <div style={{ display: 'flex', gap: 9 }}>
            <button type="button" onClick={() => setSure(false)} style={{
              minHeight: 48, padding: '0 16px', borderRadius: 12, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-sunk)', color: 'var(--c-meta)',
            }}>Cancel</button>
            <button type="submit" disabled={pending} style={{
              flex: 1, minHeight: 48, borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
              opacity: pending ? 0.65 : 1,
            }}>{pending ? 'Signing out…' : 'Sign out everywhere'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
