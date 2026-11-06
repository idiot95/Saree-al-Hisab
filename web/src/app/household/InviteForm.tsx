'use client';

import { useActionState, useState, useSyncExternalStore } from 'react';
import { createInvite } from './actions';
import { haptic } from '../haptics';
import { Icon } from '../Icon';
import { ErrorNote, Field } from '../auth-ui';
import { solid } from './rows';
import { useFocusSoon, useKeepOnRefusal, useOnSuccess } from '../worth/fields';
import { Said } from '../form-bits';

/* Say plainly what this link is. Accepted with Google it is bound to the
   address it was sent to; but until the password window closes it can also be
   used to make a password account, and then whoever opens the link can take
   the place it was meant for. The link is a credential, and the copy here
   treats it as one. */

export default function InviteForm({ origin, household, inviter, passwordOpen }: {
  origin: string; household: string; inviter: string; passwordOpen: boolean;
}) {
  const [state, act, pending] = useActionState(createInvite, null);
  // Posts directly (works without script); a refusal's form reset is undone so the role stays as chosen.
  const keep = useKeepOnRefusal(state);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'adult' | 'viewer'>('adult');
  /* Created: the message below is written from what the action returned — the invite actually made — so editing the
     fields afterwards cannot rewrite a message whose link still points at the first invite. The form is redrawn (a
     new key) so React's reset after a success cannot leave its radios and the role in state disagreeing. */
  const [round, setRound] = useState(0);
  /* The redraw takes the Create button, and focus with it: focus goes to the message's heading, the thing to act
     on next, and the live region says the invitation is ready. */
  const [ready, focusReady] = useFocusSoon<HTMLElement>();
  useOnSuccess(state, () => { setRound((r) => r + 1); focusReady(); });
  const token = state?.ok ? state.message : undefined;
  const until = state?.ok ? state.until ?? '' : '';
  const sentTo = state?.ok ? state.email ?? '' : '';
  const sentRole = state?.ok && state.role === 'viewer' ? 'viewer' : 'adult';

  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-card p-[var(--pad)]">
      <Said>{token ? `Invitation ready for ${sentTo}. The message to send is below.` : ''}</Said>
      <form key={round} action={act} {...keep} className="flex flex-col gap-3">
        <Field label="Email address" name="email" type="email" inputMode="email" autoComplete="off"
          placeholder="name@example.com" required
          value={email} onChange={(e) => setEmail(e.target.value)} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-muted-foreground">What they can do</legend>
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

        <button type="submit" disabled={pending} className={solid}>
          <Icon name="person_add" size={20} />{pending ? 'Creating…' : 'Create invitation'}
        </button>

        {state && !state.ok && <ErrorNote>{state.error}</ErrorNote>}
      </form>

      {token && (
        <InviteMessage heading={ready} url={`${origin}/join/${token}`} email={sentTo} role={sentRole}
          household={household} inviter={inviter} until={until} passwordOpen={passwordOpen} />
      )}
    </div>
  );
}

function Choice({ name, value, title, what, checked, onPick }: {
  name: string; value: string; title: string; what: string; checked: boolean; onPick: () => void;
}) {
  return (
    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${checked ? 'border-primary bg-accent' : 'border-border bg-background'}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onPick}
        className="mt-0.5 size-[19px] flex-none accent-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-sm leading-snug text-muted-foreground">{what}</span>
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

function InviteMessage({ heading, url, email, role, household, inviter, until, passwordOpen }: {
  heading: React.Ref<HTMLElement>; passwordOpen: boolean; url: string; email: string; role: 'adult' | 'viewer'; household: string; inviter: string; until: string;
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

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-accent p-3.5 text-accent-foreground">
      <h3 ref={heading as React.Ref<HTMLHeadingElement>} tabIndex={-1} className="flex items-center gap-1.5 text-sm font-bold outline-none">
        <Icon name="check_circle" size={18} />
        Invitation ready
      </h3>
      <p className="text-sm leading-normal">
        Send this to {email || 'them'} privately — it says what to do. <b>Anyone who opens the
        link can take that place in the household.</b>
      </p>
      <pre className="m-0 select-all rounded-lg border border-border bg-card px-3 py-3 font-[inherit] text-sm leading-normal whitespace-pre-wrap break-words text-foreground">{message}</pre>
      <div className="flex gap-2">
        {share && (
          <button type="button" onClick={shareIt} className={solid}>Share…</button>
        )}
        <button type="button" onClick={() => copy(message, 'message')}
          className="press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 text-base font-semibold text-foreground">
          <Icon name={copied === 'message' ? 'check' : 'content_copy'} size={18} />
          {copied === 'message' ? 'Copied' : copied === 'failed' ? 'Select the text to copy' : 'Copy message'}
        </button>
      </div>
      <button type="button" onClick={() => copy(url, 'link')}
        className="flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-[3px]">
        {copied === 'link' ? 'Link copied' : 'Copy just the link'}
      </button>
      <p className="text-xs leading-normal text-muted-foreground">
        Shown only once. If you lose it, withdraw the invitation and create a new one.
      </p>
    </div>
  );
}
