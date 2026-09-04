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
      padding: '14px 0', borderBottom: last ? undefined : '1px solid var(--c-rule)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          width: 42, height: 42, borderRadius: 999, flex: 'none', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
          background: 'var(--cat-blue)', color: 'var(--cat-blue-ink)', overflow: 'hidden',
        }}>
          {member.image
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={member.image} alt="" width={42} height={42} style={{ borderRadius: 999 }} />
            : (member.name || '?').slice(0, 2).toUpperCase()}
        </span>

        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 15.5, fontWeight: 600 }}>
            {member.name}
            {isSelf && <span style={{ color: 'var(--c-meta)', fontWeight: 500 }}> · you</span>}
          </span>
          <span style={{
            fontSize: 12.5, color: 'var(--c-meta)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{member.email}</span>
        </span>

        {!canManage || isSelf ? (
          <span style={{
            flex: 'none', fontSize: 12.5, fontWeight: 600, padding: '7px 11px', borderRadius: 9,
            background: 'var(--c-sunk)', color: 'var(--c-meta)',
          }}>{LABEL[member.role]}</span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            aria-label={confirming ? 'Close options' : `Options for ${member.name}`}
            style={{
              width: 44, height: 44, flex: 'none', borderRadius: 999, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--c-meta)',
              background: confirming ? 'var(--c-sunk)' : 'transparent',
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
          borderRadius: 13, background: 'var(--c-sunk2)',
        }}>
          <form action={saveRole} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="userId" value={member.id} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-meta)' }}>
              What {member.name.split(' ')[0]} can do
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}
                style={{
                  flex: 1, minHeight: 46, borderRadius: 11, border: '1px solid var(--c-border)',
                  background: 'var(--c-card)', color: 'var(--c-ink)', fontSize: 14.5,
                  fontWeight: 600, padding: '0 10px',
                }}
              >
                <option value="adult">Contributing member</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner — can invite and remove</option>
              </select>
              <button type="submit" disabled={savingRole || role === member.role} style={{
                minHeight: 46, padding: '0 16px', borderRadius: 11, fontSize: 14.5, fontWeight: 600,
                background: role === member.role ? 'var(--c-sunk)' : 'var(--c-seagrass)',
                color: role === member.role ? 'var(--c-meta)' : 'var(--c-on-fill)',
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
            <button type="submit" disabled={sendingReset} style={{
              minHeight: 46, borderRadius: 11, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-card)', border: '1px solid var(--c-border)',
              color: 'var(--c-ink)',
            }}>
              {sendingReset ? 'Making a link…' : 'Give them a password reset link'}
            </button>
          </form>

          {resetToken && <ResetLink url={`${origin}/reset/${resetToken}`} copied={copied} setCopied={setCopied} />}

          <form action={remove} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input type="hidden" name="userId" value={member.id} />
            <button type="submit" disabled={removing} style={{
              minHeight: 46, borderRadius: 11, fontSize: 14.5, fontWeight: 600,
              background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
            }}>
              {removing ? 'Removing…' : `Remove ${member.name.split(' ')[0]} from the household`}
            </button>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)' }}>
              Everything they recorded stays. The books belong to the household, so removing
              someone must never change what a month cost.
            </span>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" style={{
          margin: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderRadius: 11, background: 'var(--c-danger-tint)', color: 'var(--c-danger)',
          fontSize: 13, fontWeight: 600,
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
      padding: 12, borderRadius: 12, background: 'var(--c-warn-tint)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-ink)' }}>
        Hand this over in person or in a private message. Anyone who opens it can set that
        password and sign in as them. It works once and dies in a day.
      </span>
      <code style={{
        display: 'block', padding: '9px 11px', borderRadius: 9, background: 'var(--c-card)',
        border: '1px solid var(--c-border)', fontSize: 11, lineHeight: 1.5,
        wordBreak: 'break-all', color: 'var(--c-meta)',
      }}>{url}</code>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
      }} style={{
        minHeight: 44, borderRadius: 10, background: 'var(--c-card)',
        border: '1px solid var(--c-border)', color: 'var(--c-ink)', fontSize: 14, fontWeight: 600,
      }}>
        {copied ? 'Copied' : 'Copy the link'}
      </button>
    </div>
  );
}
