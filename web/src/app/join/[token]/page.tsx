import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, inviteByToken } from '@/db/queries';
import { householdsOf } from '@/db/membership';
import { AuthShell, DeadEnd, ErrorNote, maskEmail, primaryBtn, quietBtn, quietLink, Small } from '../../auth-ui';
import { Icon } from '../../Icon';
import { cn } from '@/lib/utils';
import { acceptInvitation, acceptWithGoogle } from '../actions';
import { passwordSignInOpenNow } from '@/lib/password-window';
import GoogleButton from '../../signin/GoogleButton';
import JoinForm from './JoinForm';

export const metadata = { title: 'Join a household · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Be honest about what this link is. Accepted with Google, the invitation is
   bound to the address it was sent to: Google has to vouch for that address
   or the sign-in is refused. Accepted with a password — only until the
   cutoff — there is no outside identity to prove, so the link is a
   credential: whoever opens it can take the place it was meant for. Hence
   256 bits of randomness, only the hash stored, one use, and a week to live. */

export default async function Join({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;
  const invite = await inviteByToken(token);
  const actor = await actorOrNull();

  if (!invite) {
    return <DeadEnd title="This link is not valid"
      body="Ask whoever invited you to send a new one." />;
  }
  if (invite.status === 'revoked') {
    return <DeadEnd title="This invitation was withdrawn"
      body={`Ask the owner of ${invite.household} for a new one.`} />;
  }
  if (invite.status === 'accepted') {
    return <DeadEnd title="This invitation has been used"
      body={`If that was you, sign in — you are already in ${invite.household}.`}
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (invite.expired) {
    return <DeadEnd title="This invitation has expired"
      body={`Invitations last seven days. Ask the owner of ${invite.household} for a new one.`} />;
  }

  /* Being in books of your own is not a reason to turn someone away — that is
     the ordinary case now. The only invitation with nothing left to give is
     one to a household you are already in. */
  const alreadyIn = actor
    ? (await householdsOf(actor.user_id)).some((b) => b.id === invite.household_id)
    : false;
  if (alreadyIn) redirect('/');

  const signedInAs = actor?.email ?? null;
  const wrongAccount = !!signedInAs && signedInAs.toLowerCase() !== invite.email.toLowerCase();
  const rightAccount = !!signedInAs && !wrongAccount;
  const passwordOpen = passwordSignInOpenNow();

  return (
    <AuthShell
      kicker={invite.invited_by ? `${invite.invited_by} invited you to join` : 'You have been invited to join'}
      title={invite.household}
    >
      <div className="flex items-start gap-3 rounded-2xl bg-background p-4">
        <span className="grid size-10 flex-none place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon name={invite.role === 'adult' ? 'edit' : 'visibility'} size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">Your role</span>
          <span className="text-base font-semibold">
            {invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          </span>
          <span className="text-sm leading-normal text-muted-foreground">
            {invite.role === 'adult'
              ? 'Add and edit entries, and set budgets. You will see everything the household records.'
              : 'Read every entry, budget and chart. You cannot change them.'}
          </span>
        </span>
      </div>

      {e === '1' && <ErrorNote>That invitation could not be accepted. It may have just been withdrawn.</ErrorNote>}

      {wrongAccount && (
        <>
          <ErrorNote>
            You are signed in as {signedInAs}, but this invitation was sent to
            {' '}{maskEmail(invite.email)}. Sign out and open the link again.
          </ErrorNote>
          <form action={async () => { 'use server'; await signOut({ redirectTo: `/join/${token}` }); }}>
            <button type="submit" className={quietBtn}>Sign out</button>
          </form>
        </>
      )}

      {rightAccount && actor?.household_id && (
        <Small>
          You keep your own household too. Joining adds a second one — you can switch
          between them any time.
        </Small>
      )}

      {rightAccount && (
        <form action={acceptInvitation}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={primaryBtn}>
            Join {invite.household}
          </button>
        </form>
      )}

      {!signedInAs && (
        <GoogleButton action={acceptWithGoogle} label="Accept with Google" fields={{ token }} />
      )}
      {!signedInAs && (
        <Small>
          Use the Google account for {maskEmail(invite.email)}, the address this invitation
          was sent to.
        </Small>
      )}

      {!signedInAs && invite.has_account && passwordOpen && (
        <>
          <Small>
            That email already has an account. If you sign in with a password, sign in
            first, then open this link again.
          </Small>
          <a href="/signin" className={quietBtn}>Sign in</a>
        </>
      )}

      {/* The password way in lasts only as long as password sign-in does. */}
      {!signedInAs && !invite.has_account && passwordOpen && (
        <details>
          <summary className={cn(quietLink, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
            Join with a password instead
          </summary>
          <div className="pt-1.5"><JoinForm token={token} email={invite.email} /></div>
        </details>
      )}

      <Small className="text-xs">
        <b className="text-foreground">{passwordOpen
          ? 'Anyone who opens this link can take this place.'
          : 'Only the Google account it was sent to can take this place.'}</b> Do not forward it. It works
        once and expires on {new Date(invite.expires_at).toLocaleDateString('en-IN',
          { day: 'numeric', month: 'long' })}.
      </Small>
    </AuthShell>
  );
}
