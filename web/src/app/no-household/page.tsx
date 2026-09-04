import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull } from '@/db/queries';
import StartOwn from './StartOwn';

export const metadata = { title: 'No household · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Signed in and in nobody's books — almost always because they were removed.
   Two ways out, and neither of them is a back door into someone else's
   household: wait to be invited, or open your own. */
export default async function NoHousehold() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (actor.household_id) redirect('/');

  return (
    <main style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 15, padding: '40px 30px',
      textAlign: 'center', background: 'var(--c-bg)', color: 'var(--c-ink)',
    }}>
      <span style={{
        width: 74, height: 74, borderRadius: 999, background: 'var(--cat-blue)',
        color: 'var(--cat-blue-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={35} height={35} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0 1 12 0" />
          <path d="M16 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17 14.2a6 6 0 0 1 4 5.3" />
        </svg>
      </span>

      <h1 className="t" style={{ margin: '4px 0 0', fontSize: 25, letterSpacing: '-.016em' }}>
        You are not in a household
      </h1>
      <p style={{
        margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--c-meta)', maxWidth: '34ch',
      }}>
        Signed in as {actor.user_name || 'you'}. Ask someone to invite you to theirs, or
        start your own.
      </p>

      {actor.email && (
        <p style={{
          margin: 0, display: 'flex', flexDirection: 'column', gap: 5, padding: '13px 16px',
          borderRadius: 14, background: 'var(--c-card)', border: '1px solid var(--c-border)',
          maxWidth: '34ch',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
            Ask them to invite this email
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, wordBreak: 'break-all' }}>{actor.email}</span>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--c-meta)', marginTop: 3 }}>
            An invitation is tied to the email it is sent to.
          </span>
        </p>
      )}

      <StartOwn />

      <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
        <button type="submit" style={{
          minHeight: 48, padding: '0 20px', display: 'flex', alignItems: 'center',
          borderRadius: 13, background: 'transparent', color: 'var(--c-meta)',
          fontSize: 14, fontWeight: 600, marginTop: 2,
        }}>
          Sign out
        </button>
      </form>
    </main>
  );
}
