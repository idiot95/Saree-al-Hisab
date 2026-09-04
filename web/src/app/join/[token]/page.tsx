import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/auth';
import { actorOrNull, inviteByToken } from '@/db/queries';
import { acceptInvitation } from '../actions';

export const metadata = { title: 'Join a household · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* What this page can and cannot do is the whole design:
   it SHOWS an invitation, it never grants one. Signing in is what grants it,
   and only to the Google account the invite was addressed to. So this page is
   safe to open by anyone who gets hold of the link. */

export default async function Join({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;
  const invite = await inviteByToken(token);
  const actor = await actorOrNull();

  if (!invite) return <Dead title="This link does not lead anywhere" body="It may have been mistyped, or the invitation was withdrawn. Ask whoever sent it for a new one." />;
  if (invite.status === 'revoked') return <Dead title="This invitation was withdrawn" body={`Ask whoever keeps ${invite.household}’s books for a new one.`} />;
  if (invite.status === 'accepted') return <Dead title="This invitation has already been used" body={`If that was you, sign in and you are already in ${invite.household}.`} action />;
  if (invite.expired) return <Dead title="This invitation has expired" body={`Invitations last seven days. Ask whoever keeps ${invite.household}’s books to send another.`} />;

  // Already in a household: nothing to do here.
  if (actor?.household_id) redirect('/');

  const signedInAs = actor?.email ?? null;
  const wrongAccount = !!signedInAs && signedInAs.toLowerCase() !== invite.email.toLowerCase();
  const rightAccount = !!signedInAs && !wrongAccount;

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)',
      color: 'var(--c-ink)',
    }}>
      <div className="el2" style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, rgba(0,0,0,0) 1px 26px),'
          + 'radial-gradient(130% 85% at 82% -12%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 62%),'
          + 'linear-gradient(150deg,#2C5063 0%,#233D4D 58%,#172B37 100%)',
        color: '#fff', borderRadius: '0 0 30px 30px', padding: '56px 24px 42px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <span style={{
          width: 52, height: 52, borderRadius: 15, background: 'rgba(255,255,255,.16)',
          border: '1px solid rgba(255,255,255,.24)', display: 'flex', alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width={25} height={25} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.7}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" />
            <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17 14.2a6 6 0 0 1 4 5.3" />
          </svg>
        </span>
        <p style={{ margin: 0, fontSize: 13.5, color: 'rgba(255,255,255,.78)' }}>
          {invite.invited_by ? `${invite.invited_by} invited you to` : 'You have been invited to'}
        </p>
        <h1 className="t" style={{
          margin: 0, fontSize: 34, lineHeight: 1.08, letterSpacing: '-.02em',
        }}>{invite.household}</h1>
      </div>

      <div style={{ padding: '22px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="el" style={{
          background: 'var(--c-card)', borderRadius: 16, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Line label="Invitation sent to" value={mask(invite.email)} />
          <span style={{ height: 1, background: 'var(--c-rule)' }} />
          <Line
            label="You would join as"
            value={invite.role === 'adult' ? 'Contributing member' : 'Viewer'}
          />
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
            {invite.role === 'adult'
              ? 'You can add and edit entries and set budgets, and you will see everything the household has recorded.'
              : 'You can read every entry, budget and chart. You will not be able to change any of them.'}
          </p>
        </div>

        {wrongAccount && (
          <p role="alert" style={{
            margin: 0, display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px',
            borderRadius: 13, background: 'var(--c-warn-tint)', color: 'var(--c-warn)',
            fontSize: 13, lineHeight: 1.5, fontWeight: 600,
          }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth={2} strokeLinecap="round" style={{ flex: 'none', marginTop: 2 }} aria-hidden>
              <path d="M12 4.5 21 19.5H3z" /><path d="M12 10v3.6" /><path d="M12 16.6v.1" />
            </svg>
            You are signed in as {signedInAs}. This invitation is for a different
            account — sign out and open this link again.
          </p>
        )}
      </div>

      <div style={{
        marginTop: 'auto', padding: '24px 20px 26px', display: 'flex',
        flexDirection: 'column', gap: 11,
      }}>
        {e === '1' && (
          <p role="alert" style={{
            margin: 0, padding: '12px 14px', borderRadius: 13, fontSize: 13, fontWeight: 600,
            background: 'var(--c-danger-tint)', color: 'var(--c-danger)', textAlign: 'center',
          }}>
            That invitation could not be accepted. It may have just been withdrawn.
          </p>
        )}

        {wrongAccount && (
          <form action={async () => { 'use server'; await signOut({ redirectTo: `/join/${token}` }); }}>
            <button type="submit" style={btn}>Sign out</button>
          </form>
        )}

        {rightAccount && (
          <form action={acceptInvitation}>
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="el2" style={{
              ...btn, border: 0, color: '#fff',
              background:
                'radial-gradient(120% 100% at 25% 0%, rgba(255,255,255,.18) 0%, rgba(255,255,255,0) 60%),'
                + 'linear-gradient(145deg,#2C5063 0%,#1C3541 100%)',
            }}>
              Join {invite.household}
            </button>
          </form>
        )}

        {!signedInAs && (
          <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
            <button type="submit" className="el2" style={btn}>
              <GoogleMark />
              Continue with Google
            </button>
          </form>
        )}
        <p style={{
          margin: '6px 4px 0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
          color: 'var(--c-meta)',
        }}>
          Only {mask(invite.email)} can accept this. The link on its own admits nobody.
        </p>
      </div>
    </main>
  );
}

/** Enough for the person invited to recognise their own address, not enough
 *  for whoever finds the link to learn someone else's. */
function mask(email: string) {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>{label}</span>
      <span style={{ fontSize: 15.5, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function Dead({ title, body, action }: { title: string; body: string; action?: boolean }) {
  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, padding: '40px 34px', textAlign: 'center',
      background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 68, height: 68, borderRadius: 999, background: 'var(--c-sunk)',
        color: 'var(--c-meta)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="8.6" /><path d="M12 7.6V13" /><path d="M12 16.4v.1" />
        </svg>
      </span>
      <h1 className="t" style={{ margin: 0, fontSize: 24, letterSpacing: '-.016em' }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '32ch' }}>
        {body}
      </p>
      {action && (
        <form action={async () => { 'use server'; await signIn('google', { redirectTo: '/' }); }}>
          <button type="submit" className="el2" style={{ ...btn, marginTop: 8 }}>
            <GoogleMark />
            Continue with Google
          </button>
        </form>
      )}
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width={20} height={20} viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.8-2 5.1-4.4 6.7v5.6h7.1c4.2-3.8 6.6-9.5 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.2l-7.1-5.6c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.6-3.9-12.3-9.1H4.3v5.8C7.8 41.1 15.3 46 24 46z" />
      <path fill="#FBBC05" d="M11.7 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.8H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.4-5.6z" />
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 30 2 24 2 15.3 2 7.8 6.9 4.3 14.2l7.4 5.8c1.7-5.2 6.6-9.3 12.3-9.3z" />
    </svg>
  );
}

const btn: React.CSSProperties = {
  width: '100%', minHeight: 58, borderRadius: 16, background: 'var(--c-card)',
  color: 'var(--c-ink)', fontSize: 16.5, fontWeight: 600, border: '1px solid var(--c-border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 11,
};
