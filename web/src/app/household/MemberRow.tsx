'use client';

import { useActionState, useState } from 'react';
import { changeRole, issueReset, removeMember } from './actions';
import { statusPill } from '../form-bits';
import { Icon } from '../Icon';
import { ErrorNote } from '../auth-ui';
import { Avatar } from './rows';
import { keepFields } from '../form-hooks';

type Role = 'owner' | 'adult' | 'viewer';
const LABEL: Record<Role, string> = {
  owner: 'Owner', adult: 'Contributing member', viewer: 'Viewer',
};

export default function MemberRow({ member, canManage, isSelf, origin }: {
  member: {
    id: string; name: string; email: string | null; image: string | null; role: Role;
    has_google: boolean;
  };
  canManage: boolean; isSelf: boolean; origin: string;
}) {
  const [roleState, saveRole, savingRole] = useActionState(changeRole, null);
  const [removeState, remove, removing] = useActionState(removeMember, null);
  const [resetState, sendReset, sendingReset] = useActionState(issueReset, null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<Role>(member.role);
  const resetToken = resetState?.ok ? resetState.message : undefined;
  const first = member.name.split(' ')[0];

  const error = (roleState && !roleState.ok && roleState.error)
    || (removeState && !removeState.ok && removeState.error)
    || (resetState && !resetState.ok && resetState.error) || null;

  return (
    <div className="flex flex-col gap-3 px-[var(--pad)] py-3">
      <div className="flex items-center gap-3">
        <Avatar name={member.name} image={member.image} />

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body font-semibold leading-snug [overflow-wrap:anywhere]">
            {member.name}
            {isSelf && <span className="font-medium text-muted-foreground"> · you</span>}
          </span>
          <span className="text-subhead leading-snug text-muted-foreground [overflow-wrap:anywhere]">{member.email}</span>
          {/* For the owner, who is the one who will have to chase anyone not
              linked before passwords end. An icon and a word, never colour. */}
          {canManage && (
            <span className="inline-flex items-center gap-1 text-footnote font-semibold text-muted-foreground">
              <Icon name={member.has_google ? 'linked' : 'unlinked'} size={15} />
              {member.has_google ? 'Signed in with Google' : 'Not linked yet'}
            </span>
          )}
        </span>

        {!canManage || isSelf ? (
          <span className={`${statusPill} bg-muted text-muted-foreground`}>
            {LABEL[member.role]}
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming((v) => !v)}
            aria-label={confirming ? 'Close options' : `Options for ${member.name}`}
            aria-expanded={confirming}
            className={`press grid size-11 flex-none place-items-center rounded-full text-muted-foreground in-data-[platform=android]:size-12 ${confirming ? 'bg-muted' : ''}`}
          >
            <Icon name={confirming ? 'close' : 'more_horiz'} size={22} />
          </button>
        )}
      </div>

      {canManage && !isSelf && confirming && (
        <div className="flex flex-col gap-3 rounded-2xl bg-background p-3">
          {/* JS-only (opened from the options button): keepFields, so a refusal never resets the role select. */}
          <form onSubmit={keepFields(saveRole)} className="flex flex-col gap-2">
            <input type="hidden" name="userId" value={member.id} />
            <span className="text-subhead font-medium text-muted-foreground">What {first} can do</span>
            <div className="flex gap-2">
              <select
                name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}
                aria-label={`What ${first} can do`}
                className="min-h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-2.5 text-[length:var(--field)] font-semibold text-foreground"
              >
                <option value="adult">Contributing member</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button type="submit" disabled={savingRole || role === member.role}
                className="press flex min-h-12 flex-none items-center justify-center rounded-xl bg-primary px-4 text-headline font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground">
                {savingRole ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>

          {/* Nobody here can send email, so a forgotten password is recovered
              the way anything else in a household is: you ask, and the owner
              hands over a link. */}
          <form action={sendReset}>
            <input type="hidden" name="userId" value={member.id} />
            <button type="submit" disabled={sendingReset}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-headline font-semibold text-foreground disabled:opacity-60">
              <Icon name="key" size={20} />{sendingReset ? 'Creating…' : 'Send a password reset link'}
            </button>
          </form>

          {resetToken && <ResetLink url={`${origin}/reset/${resetToken}`} copied={copied} setCopied={setCopied} />}

          <form action={remove} className="flex flex-col gap-1.5">
            <input type="hidden" name="userId" value={member.id} />
            <button type="submit" disabled={removing}
              className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 text-headline font-semibold text-destructive disabled:opacity-60">
              <Icon name="delete" size={20} />{removing ? 'Removing…' : `Remove ${first}`}
            </button>
            <span className="text-footnote leading-snug text-muted-foreground">
              Their entries stay. Removing someone never changes what a month cost.
            </span>
          </form>
        </div>
      )}

      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}


function ResetLink({ url, copied, setCopied }: {
  url: string; copied: boolean; setCopied: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-attention-soft p-3 text-attention-soft-foreground">
      <span className="flex items-start gap-2 text-body leading-normal">
        <Icon name="warning" size={18} className="mt-px" />
        <span>Send this privately. <b>Anyone who opens it can set that password and sign in as
        them.</b> It works once and expires in a day.</span>
      </span>
      <code className="block rounded-lg border border-border bg-card px-3 py-2 text-footnote leading-normal break-all text-muted-foreground">{url}</code>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
      }} className="press flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card text-body font-semibold text-foreground">
        <Icon name={copied ? 'check' : 'content_copy'} size={18} />{copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
