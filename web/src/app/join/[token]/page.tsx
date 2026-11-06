import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, inviteByToken } from '@/db/queries';
import { householdsOf } from '@/db/membership';
import { AuthShell, DeadEnd, ErrorNote, maskEmail, primaryBtn, quietBtn } from '../../auth-ui';
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
      <div style={{ padding: '22px var(--gutter) 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="border border-border" style={{
          background: 'var(--card)', borderRadius: 16, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--muted-foreground)' }}>
            Your role
          </span>
          <span style={{ fontSize: 'var(--step-0)', fontWeight: 600 }}>
            {invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          </span>
          <span style={{ fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            {invite.role === 'adult'
              ? 'Add and edit entries, and set budgets. You will see everything the household records.'
              : 'Read every entry, budget and chart. You cannot change them.'}
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
              <button type="submit" style={quietBtn}>Sign out</button>
            </form>
          </>
        )}

        {rightAccount && actor?.household_id && (
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            You keep your own household too. Joining adds a second one — you can switch
            between them any time.
          </p>
        )}

        {rightAccount && (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <button type="submit"  style={primaryBtn}>
              Join {invite.household}
            </button>
          </form>
        )}

        {!signedInAs && (
          <GoogleButton action={acceptWithGoogle} label="Accept with Google" fields={{ token }} />
        )}
        {!signedInAs && (
          <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
            Use the Google account for {maskEmail(invite.email)}, the address this invitation
            was sent to.
          </p>
        )}

        {!signedInAs && invite.has_account && passwordOpen && (
          <>
            <p style={{ margin: 0, fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
              That email already has an account. If you sign in with a password, sign in
              first, then open this link again.
            </p>
            <a href="/signin" style={quietBtn}>Sign in</a>
          </>
        )}

        {/* The password way in lasts only as long as password sign-in does. */}
        {!signedInAs && !invite.has_account && passwordOpen && (
          <details>
            <summary style={{
              listStyle: 'none', cursor: 'pointer', textAlign: 'center', padding: '12px 0',
              fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--foreground)',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Join with a password instead
            </summary>
            <div style={{ paddingTop: 6 }}><JoinForm token={token} email={invite.email} /></div>
          </details>
        )}

        <p style={{ margin: '2px 4px 0', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--muted-foreground)' }}>
          <b>{passwordOpen
            ? 'Anyone who opens this link can take this place.'
            : 'Only the Google account it was sent to can take this place.'}</b> Do not forward it. It works
          once and expires on {new Date(invite.expires_at).toLocaleDateString('en-IN',
            { day: 'numeric', month: 'long' })}.
        </p>
      </div>
    </AuthShell>
  );
}
