import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull } from '@/db/queries';

export const metadata = { title: 'Waiting for an invite · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Signed in, but in nobody's books. This screen exists because the alternative
   — dropping anyone who signs up into the first household they find — would be
   a hole, not a feature. */
export default async function NoHousehold() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (actor.household_id) redirect('/');

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px 34px',
      textAlign: 'center', background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 76, height: 76, borderRadius: 999, background: 'var(--cat-blue)',
        color: 'var(--cat-blue-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" />
          <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17 14.2a6 6 0 0 1 4 5.3" />
        </svg>
      </span>
      <h1 className="t" style={{ margin: '6px 0 0', fontSize: 25, letterSpacing: '-.016em' }}>
        You are signed in as {actor.user_name || 'yourself'}
      </h1>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '32ch' }}>
        You are not in a household yet. Someone who is already in one has to invite you before
        you can see any books.
      </p>
      {actor.email && (
        <p style={{
          margin: 0, display: 'flex', flexDirection: 'column', gap: 5, padding: '13px 16px',
          borderRadius: 14, background: 'var(--c-card)', border: '1px solid var(--c-border)',
          maxWidth: '34ch',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
            Ask them to invite this address
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>{actor.email}</span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)', marginTop: 3 }}>
            An invitation is tied to the address it is sent to, so it has to be this one.
          </span>
        </p>
      )}
      <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
        <button type="submit" style={{
          minHeight: 50, padding: '0 22px', display: 'flex', alignItems: 'center',
          borderRadius: 14, background: 'var(--c-sunk)', color: 'var(--c-meta)',
          fontSize: 15, fontWeight: 600, marginTop: 8,
        }}>
          Sign out
        </button>
      </form>
    </main>
  );
}
