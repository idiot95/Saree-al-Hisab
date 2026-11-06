'use client';

import { useActionState, useState, useSyncExternalStore } from 'react';
import { createInvite } from './actions';
import { haptic } from '../haptics';

/* Say plainly what this link is. Accepted with Google it is bound to the
   address it was sent to; but until the password window closes it can also be
   used to make a password account, and then whoever opens the link can take
   the place it was meant for. The link is a credential, and the copy here
   treats it as one. */

export default function InviteForm({ origin, household, inviter, passwordOpen }: {
  origin: string; household: string; inviter: string; passwordOpen: boolean;
}) {
  const [state, act, pending] = useActionState(createInvite, null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'adult' | 'viewer'>('adult');
  const token = state?.ok ? state.message : undefined;
  const until = state?.ok ? state.until ?? '' : '';

  return (
    <>
      <div className="mx-[var(--gutter)] mb-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite someone</h2>
      </div>

      <section className="border border-border" style={{
        margin: '0 var(--gutter) 22px', background: 'var(--card)', borderRadius: 18, padding: 16,
      }}>
        <form action={act} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              Email address
            </span>
            <input
              name="email" type="email" inputMode="email" autoComplete="off"
              placeholder="name@example.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{
                minHeight: 50, borderRadius: 13, border: '1px solid var(--border)',
                background: 'var(--background)', color: 'var(--foreground)', fontSize: 'var(--field)',
                padding: '0 14px', width: '100%',
              }}
            />
          </label>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <legend style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)', padding: 0 }}>
              What they can do
            </legend>
            <Choice
              name="role" value="adult" checked={role === 'adult'} onPick={() => setRole('adult')}
              title="Contributing member"
              what="Adds and edits entries, and sets budgets."
            />
            <Choice
              name="role" value="viewer" checked={role === 'viewer'} onPick={() => setRole('viewer')}
              title="Viewer"
              what="Reads everything. Cannot change anything."
            />
          </fieldset>

          <button className="cta" type="submit" disabled={pending} style={{
            minHeight: 52, borderRadius: 14, fontSize: 'var(--step-0)', fontWeight: 600, color: 'var(--primary-foreground)',
            opacity: pending ? 0.6 : 1,
            background:
              'var(--primary)',
          }}>
            {pending ? 'Creating…' : 'Create invitation'}
          </button>

          {state && !state.ok && (
            <p role="alert" style={{
              margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px',
              borderRadius: 12, background: 'color-mix(in srgb, var(--destructive) 12%, transparent)', color: 'var(--destructive)',
              fontSize: 'var(--step--1)', fontWeight: 600,
            }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth={2} strokeLinecap="round" style={{ flex: 'none' }} aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.4v.1" />
              </svg>
              {state.error}
            </p>
          )}
        </form>

        {token && (
          <InviteMessage url={`${origin}/join/${token}`} email={email} role={role}
            household={household} inviter={inviter} until={until} passwordOpen={passwordOpen} />
        )}
      </section>
    </>
  );
}

function Choice({ name, value, title, what, checked, onPick }: {
  name: string; value: string; title: string; what: string; checked: boolean; onPick: () => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 11, minHeight: 44, padding: '12px 13px',
      borderRadius: 13, background: 'var(--background)', border: '1px solid var(--border)',
      cursor: 'pointer',
    }}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick}
        style={{ width: 19, height: 19, marginTop: 1, accentColor: 'var(--chart-1)', flex: 'none' }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.45, color: 'var(--muted-foreground)' }}>{what}</span>
      </span>
    </label>
  );
}

/* What the owner actually sends. A bare link in a chat is a puzzle — where
   does it go, what do I do there, is this safe — so the message answers all
   three before it is opened: who is inviting, into what, the two steps that
   follow, and what the link is. Share hands it to whichever app the phone
   offers; Copy is for everywhere else. The link on its own is still there
   for anyone who wants only that. */
const noSub = () => () => {};
const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

function InviteMessage({ url, email, role, household, inviter, until, passwordOpen }: {
  passwordOpen: boolean; url: string; email: string; role: 'adult' | 'viewer'; household: string; inviter: string; until: string;
}) {
  const [copied, setCopied] = useState<'idle' | 'message' | 'link' | 'failed'>('idle');
  const share = useSyncExternalStore(noSub, canShare, () => false);

  const message = [
    `${inviter || 'Someone'} has invited you to ${household} on Saree al-Hisab — the household's books, on the phone.`,
    '',
    `1. Open this link: ${url}`,
    `2. Tap Accept with Google, using the address this was sent to${email ? ` (${email})` : ''}.${passwordOpen
      ? ' Or, for now, choose a password instead.' : ''} That is your account made — nothing else to set up.`,
    `3. You land in ${household} straight away, ${role === 'adult'
      ? 'where you can add and edit entries and set budgets.'
      : 'where you can read everything but change nothing.'}`,
    '',
    `Already have an account? Sign in with ${email || 'this address'} first, then open the link.`,
    '',
    `The link works once${until ? ` and expires on ${until}` : ''}. Keep it to yourself — whoever opens it takes your place.`,
  ].join('\n');

  const copy = async (text: string, what: 'message' | 'link') => {
    try { await navigator.clipboard.writeText(text); setCopied(what); haptic('success'); }
    catch { setCopied('failed'); haptic('warn'); }
  };
  const shareIt = async () => {
    try { await navigator.share({ title: `Join ${household}`, text: message }); haptic('success'); }
    catch { /* dismissed, or refused — the copy buttons are right there */ }
  };

  const btn = {
    minHeight: 46, borderRadius: 12, fontSize: 'var(--step-0)', fontWeight: 600, flex: 1,
  } as const;

  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 14, background: 'var(--accent)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 7, fontSize: 'var(--step--1)', fontWeight: 700,
        color: 'var(--primary)',
      }}>
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
        Invitation ready
      </span>
      <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--foreground)' }}>
        Send this to {email || 'them'} privately — it says what to do. <b>Anyone who opens the
        link can take that place in the household.</b>
      </p>
      <pre style={{
        margin: 0, padding: '12px 13px', borderRadius: 10, background: 'var(--card)',
        border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 'var(--step--1)',
        lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--foreground)',
        userSelect: 'all',
      }}>{message}</pre>
      <div style={{ display: 'flex', gap: 8 }}>
        {share && (
          <button className="cta el" type="button" onClick={shareIt} style={{
            ...btn, background: 'var(--primary)', color: 'var(--primary-foreground)',
          }}>Share…</button>
        )}
        <button className="cta" type="button" onClick={() => copy(message, 'message')} style={{
          ...btn, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)',
        }}>
          {copied === 'message' ? 'Copied' : copied === 'failed' ? 'Select the text to copy' : 'Copy message'}
        </button>
      </div>
      <button type="button" onClick={() => copy(url, 'link')} style={{
        alignSelf: 'flex-start', minHeight: 44, padding: 0, background: 'none', border: 0,
        fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}>
        {copied === 'link' ? 'Link copied' : 'Copy just the link'}
      </button>
      <p style={{ margin: 0, fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
        Shown only once. If you lose it, withdraw the invitation and create a new one.
      </p>
    </div>
  );
}
