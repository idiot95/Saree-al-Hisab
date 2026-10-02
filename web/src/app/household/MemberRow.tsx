'use client';

import { useActionState, useState } from 'react';
import { changeRole, issueReset, removeMember } from './actions';

type Role = 'owner' | 'adult' | 'viewer';
const LABEL: Record<Role, string> = {
  owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer',
};

export default function MemberRow({ member, canManage, isSelf, last, origin }: {
  member: { id: string; name: string; email: string | null; image: string | null; role: Role };
  canManage: boolean; isSelf: boolean; last: boolean; origin: string;
}) {
  const [roleState, saveRole, savingRole] = useActionState(changeRole, null);
  const [removeState, remove, removing] = useActionState(removeMember, null);
  const [resetState, sendReset, sendingReset] = useActionState(issueReset, null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<Role>(member.role);
  const resetToken = resetState?.ok ? resetState.message : undefined;

  const error = (roleState && !roleState.ok && roleState.error)
    || (removeState && !removeState.ok && removeState.error)
    || (resetState && !resetState.ok && resetState.error) || null;

  return (
    <div style={{
      padding: '14px 0', borderBottom: last ? undefined : '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 999, flex: 'none', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 'var(--step--1)', fontWeight: 700,
          background: 'var(--cat-blue)', color: 'var(--cat-blue-ink)', overflow: 'hidden',
        }}>
          {member.image
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={member.image} alt="" width={42} height={42} style={{ borderRadius: 999 }} />
            : (member.name || '?').slice(0, 2).toUpperCase()}
        </span>

        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
            {member.name}
            {isSelf && <span style={{ color: 'var(--muted-foreground)', fontWeight: 500 }}> · you</span>}
          </span>
          <span style={{
            fontSize: 'var(--step--1)', color: 'var(--muted-foreground)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{member.email}</span>
        </span>

        {!canManage || isSelf ? (
          <span style={{
            flex: 'none', fontSize: 'var(--step--1)', fontWeight: 600, padding: '7px 11px', borderRadius: 9,
            background: 'var(--muted)', color: 'var(--muted-foreground)',
          }}>{LABEL[member.role]}</span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            aria-label={confirming ? 'Close options' : `Options for ${member.name}`}
            style={{
              width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)',
              background: confirming ? 'var(--muted)' : 'transparent',
            }}
          >
            <svg width={19} height={19} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="5.5" r="1.7" /><circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="18.5" r="1.7" />
            </svg>
          </button>
        )}
      </div>

      {canManage && !isSelf && confirming && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
          borderRadius: 13, background: 'var(--background)',
        }}>
          <form action={saveRole} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="userId" value={member.id} />
            <span style={{ fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              What {member.name.split(' ')[0]} can do
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 11, border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--foreground)', fontSize: 'var(--field)',
                  fontWeight: 600, padding: '0 10px',
                }}
              >
                <option value="adult">Contributing member</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button className="cta" type="submit" disabled={savingRole || role === member.role} style={{
                minHeight: 46, padding: '0 16px', borderRadius: 11, fontSize: 'var(--step-0)', fontWeight: 600,
                background: role === member.role ? 'var(--muted)' : 'var(--chart-1)',
                color: role === member.role ? 'var(--muted-foreground)' : 'var(--attention-soft-foreground)',
              }}>
                {savingRole ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          {/* Nobody here can send email, so a forgotten password is recovered
              the way anything else in a household is: you ask, and the owner
              hands over a link. */}
          <form action={sendReset} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="hidden" name="userId" value={member.id} />
            <button className="cta" type="submit" disabled={sendingReset} style={{
              minHeight: 46, borderRadius: 11, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}>
              {sendingReset ? 'Creating…' : 'Send a password reset link'}
            </button>
          </form>

          {resetToken && <ResetLink url={`${origin}/reset/${resetToken}`} copied={copied} setCopied={setCopied} />}

          <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="hidden" name="userId" value={member.id} />
            <button className="cta" type="submit" disabled={removing} style={{
              minHeight: 46, borderRadius: 11, fontSize: 'var(--step-0)', fontWeight: 600,
              background: 'color-mix(in srgb, var(--destructive) 12%, transparent)', color: 'var(--destructive)',
            }}>
              {removing ? 'Removing…' : `Remove ${member.name.split(' ')[0]}`}
            </button>
            <span style={{ fontSize: 'var(--step--2)', lineHeight: 1.45, color: 'var(--muted-foreground)' }}>
              Their entries stay. Removing someone never changes what a month cost.
            </span>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" style={{
          margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderRadius: 11, background: 'color-mix(in srgb, var(--destructive) 12%, transparent)', color: 'var(--destructive)',
          fontSize: 'var(--step--1)', fontWeight: 600,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" style={{ flex: 'none' }} aria-hidden>
            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5" /><path d="M12 16.4v.1" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}


function ResetLink({ url, copied, setCopied }: {
  url: string; copied: boolean; setCopied: (v: boolean) => void;
}) {
  return (
    <div style={{
      padding: 12, borderRadius: 12, background: 'var(--attention-soft)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--foreground)' }}>
        Send this privately. <b>Anyone who opens it can set that password and sign in as
        them.</b> It works once and expires in a day.
      </span>
      <code style={{
        display: 'block', padding: '9px 11px', borderRadius: 9, background: 'var(--card)',
        border: '1px solid var(--border)', fontSize: 'var(--step--2)', lineHeight: 1.5,
        wordBreak: 'break-all', color: 'var(--muted-foreground)',
      }}>{url}</code>
      <button className="cta" type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
      }} style={{
        minHeight: 44, borderRadius: 10, background: 'var(--card)',
        border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 'var(--step--1)', fontWeight: 600,
      }}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
