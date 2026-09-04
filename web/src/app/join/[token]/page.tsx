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
    return <DeadEnd title="This link goes nowhere"
      body="Mistyped, withdrawn, or invented. Whichever it is, ask whoever sent it to try again." />;
  }
  if (invite.status === 'revoked') {
    return <DeadEnd title="Somebody changed their mind"
      body={`This invitation was withdrawn. Take it up with whoever keeps ${invite.household}’s books.`} />;
  }
  if (invite.status === 'accepted') {
    return <DeadEnd title="Already spent"
      body={`An invitation works once. If it was you who used it, you are already in ${invite.household} — just sign in.`}
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (invite.expired) {
    return <DeadEnd title="Too late"
      body={`Invitations last a week and this one did not. Ask whoever keeps ${invite.household}’s books to cut another.`} />;
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
      kicker={invite.invited_by ? `${invite.invited_by} is letting you into` : 'Somebody is letting you into'}
      title={invite.household}
    >
      <div style={{ padding: '22px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="el" style={{
          background: 'var(--c-card)', borderRadius: 16, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 9,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
            You would be a
          </span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>
            {invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          </span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            {invite.role === 'adult'
              ? 'Add entries, edit them, set budgets. You will also see every rupee anyone else has recorded, which cuts both ways.'
              : 'Read every entry, budget and chart, and change precisely none of them. Restful, in its way.'}
          </span>
        </div>

        {e === '1' && <ErrorNote>That did not take. The invitation may have been withdrawn while you were reading.</ErrorNote>}

        {wrongAccount && (
          <>
            <ErrorNote>
              You are signed in as {signedInAs}. This invitation was written to
              {' '}{maskEmail(invite.email)}, which is somebody else. Sign out and try the
              link again.
            </ErrorNote>
            <form action={async () => { 'use server'; await signOut({ redirectTo: `/join/${token}` }); }}>
              <button type="submit" style={quietBtn}>Sign out</button>
            </form>
          </>
        )}

        {rightAccount && actor?.household_id && (
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            You already keep books of your own. Joining these adds a second set — separate,
            side by side, and you flip between them whenever you like.
          </p>
        )}

        {rightAccount && (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="el2" style={primaryBtn}>
              {actor?.household_id ? `Join ${invite.household} as well` : `Take my place in ${invite.household}`}
            </button>
          </form>
        )}

        {!signedInAs && invite.has_account && (
          <>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
              That address already has an account. Sign in with it and come back to this
              link — we will still be here.
            </p>
            <a href="/signin" style={quietBtn}>Sign in</a>
          </>
        )}

        {!signedInAs && !invite.has_account && <JoinForm token={token} email={invite.email} />}

        <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          <b>Anyone holding this link can take this place</b> — there is no second check.
          Works once, and dead by {new Date(invite.expires_at).toLocaleDateString('en-IN',
            { day: 'numeric', month: 'long' })}. Do not forward it.
        </p>
      </div>
    </AuthShell>
  );
}
