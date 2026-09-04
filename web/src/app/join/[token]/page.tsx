import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull, inviteByToken } from '@/db/queries';
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
    return <DeadEnd title="This link does not lead anywhere"
      body="It may have been mistyped, or the invitation was withdrawn. Ask whoever sent it for a new one." />;
  }
  if (invite.status === 'revoked') {
    return <DeadEnd title="This invitation was withdrawn"
      body={`Ask whoever keeps ${invite.household}’s books for a new one.`} />;
  }
  if (invite.status === 'accepted') {
    return <DeadEnd title="This invitation has already been used"
      body={`If that was you, sign in and you are already in ${invite.household}.`}
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (invite.expired) {
    return <DeadEnd title="This invitation has expired"
      body={`Invitations last seven days. Ask whoever keeps ${invite.household}’s books to send another.`} />;
  }

  if (actor?.household_id) redirect('/');

  const signedInAs = actor?.email ?? null;
  const wrongAccount = !!signedInAs && signedInAs.toLowerCase() !== invite.email.toLowerCase();
  const rightAccount = !!signedInAs && !wrongAccount;

  return (
    <AuthShell
      kicker={invite.invited_by ? `${invite.invited_by} invited you to` : 'You have been invited to'}
      title={invite.household}
    >
      <div style={{ padding: '22px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="el" style={{
          background: 'var(--c-card)', borderRadius: 16, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
            You would join as
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            {invite.role === 'adult'
              ? 'You can add and edit entries and set budgets, and you will see everything the household has recorded.'
              : 'You can read every entry, budget and chart. You will not be able to change any of them.'}
          </span>
        </div>

        {e === '1' && <ErrorNote>That invitation could not be accepted. It may have just been withdrawn.</ErrorNote>}

        {wrongAccount && (
          <>
            <ErrorNote>
              You are signed in as {signedInAs}, and this invitation was written to
              {' '}{maskEmail(invite.email)}. Sign out and open the link again.
            </ErrorNote>
            <form action={async () => { 'use server'; await signOut({ redirectTo: `/join/${token}` }); }}>
              <button type="submit" style={quietBtn}>Sign out</button>
            </form>
          </>
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
              There is already an account for {maskEmail(invite.email)}. Sign in with it, then
              open this link again.
            </p>
            <a href="/signin" style={quietBtn}>Sign in</a>
          </>
        )}

        {!signedInAs && !invite.has_account && <JoinForm token={token} email={invite.email} />}

        <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          This link works once and expires {new Date(invite.expires_at).toLocaleDateString('en-IN',
            { day: 'numeric', month: 'long' })}. Anyone holding it can take this place, so do not
          pass it on.
        </p>
      </div>
    </AuthShell>
  );
}
