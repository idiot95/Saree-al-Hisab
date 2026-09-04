'use client';

import { useActionState, useState } from 'react';
import { createInvite } from './actions';

/* Say plainly what this link is. Sign-in is an address and a password we hold
   ourselves, so there is no outside identity for an invitation to lean on:
   whoever opens the link can take the place it was meant for. The link is
   therefore a credential, and the copy here treats it as one. */

export default function InviteForm({ origin }: { origin: string }) {
  const [state, act, pending] = useActionState(createInvite, null);
  const [email, setEmail] = useState('');
  const token = state?.ok ? state.message : undefined;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 20px 12px' }}>
        <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 600, letterSpacing: '-.012em' }}>
          Invite someone
        </h2>
        <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
      </div>

      <section className="el" style={{
        margin: '0 18px 22px', background: 'var(--c-card)', borderRadius: 18, padding: 16,
      }}>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>
              Their email address
            </span>
            <input
              name="email" type="email" inputMode="email" autoComplete="off"
              placeholder="name@example.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{
                minHeight: 50, borderRadius: 13, border: '1px solid var(--c-border)',
                background: 'var(--c-sunk2)', color: 'var(--c-ink)', fontSize: 16,
                padding: '0 14px', width: '100%',
              }}
            />
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)', padding: 0 }}>
              What they can do
            </legend>
            <Choice
              name="role" value="adult" defaultChecked
              title="Contributing member"
              what="Adds and edits entries, sets budgets. Cannot invite or remove people."
            />
            <Choice
              name="role" value="viewer"
              title="Viewer"
              what="Reads everything. Cannot change a single figure."
            />
          </fieldset>

          <button type="submit" disabled={pending} style={{
            minHeight: 52, borderRadius: 14, fontSize: 16, fontWeight: 600, color: '#fff',
            opacity: pending ? 0.6 : 1,
            background:
              'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
              + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
          }}>
            {pending ? 'Creating…' : 'Create the invite'}
          </button>

          {state && !state.ok && (
            <p role="alert" style={{
              margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
              borderRadius: 12, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
              fontSize: 13.5, fontWeight: 600,
            }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" style={{ flex: 'none' }} aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.4v.1" />
              </svg>
              {state.error}
            </p>
          )}
        </form>

        {token && <InviteLink url={`${origin}/join/${token}`} email={email} />}
      </section>
    </>
  );
}

function Choice({ name, value, title, what, defaultChecked }: {
  name: string; value: string; title: string; what: string; defaultChecked?: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '12px 13px',
      borderRadius: 13, background: 'var(--c-sunk2)', border: '1px solid var(--c-border)',
      cursor: 'pointer',
    }}>
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked}
        style={{ width: 19, height: 19, marginTop: 1, accentColor: 'var(--c-seagrass)', flex: 'none' }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--c-meta)' }}>{what}</span>
      </span>
    </label>
  );
}

function InviteLink({ url, email }: { url: string; email: string }) {
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 14, background: 'var(--c-ok-tint)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700,
        color: 'var(--c-ok)',
      }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
        Invite ready
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-ink)' }}>
        Send this to {email || 'them'} privately — a message, not a group. Anyone who opens it
        can take that place in the household, so treat it like a key. It works once and
        expires in seven days.
      </p>
      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
        This is the only time it is shown. If you lose it, revoke the invitation and send
        a new one.
      </p>
      <code style={{
        display: 'block', padding: '10px 12px', borderRadius: 10, background: 'var(--c-card)',
        border: '1px solid var(--c-border)', fontSize: 11.5, lineHeight: 1.5,
        wordBreak: 'break-all', color: 'var(--c-meta)',
      }}>{url}</code>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url); setCopied('done'); }
          catch { setCopied('failed'); }
        }}
        style={{
          minHeight: 46, borderRadius: 12, background: 'var(--c-card)',
          border: '1px solid var(--c-border)', color: 'var(--c-ink)',
          fontSize: 14.5, fontWeight: 600,
        }}
      >
        {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Select the link above to copy' : 'Copy the link'}
      </button>
    </div>
  );
}
