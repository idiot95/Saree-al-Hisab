import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, inviteByToken } from '@/db/queries';
import { householdsOf } from '@/db/membership';
import { AuthShell, DeadEnd, ErrorNote, maskEmail, primaryBtn, quietBtn } from '../../auth-ui';
import { acceptInvitation } from '../actions';
import JoinForm from './JoinForm';

export const metadata = { title: 'Join a household · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Be honest about what this link is. With a password login there is no outside
   identity to prove, so an invitation link is a credential: whoever opens it
   can take the place it was meant for. Hence 256 bits of randomness, only the
   hash stored, one use, and a week to live — and the screen that hands the
   owner this link says exactly that. */

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

  return (
    <AuthShell
      kicker={invite.invited_by ? `${invite.invited_by} invited you to join` : 'You have been invited to join'}
      title={invite.household}
    >
      <div style={{ padding: '22px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="el" style={{
          background: 'var(--c-card)', borderRadius: 16, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
            Your role
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
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
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            You keep your own household too. Joining adds a second one — you can switch
            between them any time.
          </p>
        )}

        {rightAccount && (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="el2" style={primaryBtn}>
              Join {invite.household}
            </button>
          </form>
        )}

        {!signedInAs && invite.has_account && (
          <>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
              That email already has an account. Sign in, then open this link again.
            </p>
            <a href="/signin" style={quietBtn}>Sign in</a>
          </>
        )}

        {!signedInAs && !invite.has_account && <JoinForm token={token} email={invite.email} />}

        <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          <b>Anyone who opens this link can take this place.</b> Do not forward it. It works
          once and expires on {new Date(invite.expires_at).toLocaleDateString('en-IN',
            { day: 'numeric', month: 'long' })}.
        </p>
      </div>
    </AuthShell>
  );
}
