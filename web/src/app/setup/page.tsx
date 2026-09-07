import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull } from '@/db/queries';
import { AuthShell } from '../auth-ui';
import SetupForm from './SetupForm';

export const metadata = { title: 'Set up your household · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* The second half of signing up: an account exists, the books do not. Also
   where someone with an account and no household comes to start their own.
   Nothing here reaches anybody else's books — that still takes an invitation. */
export default async function Setup() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (actor.household_id) redirect('/');

  return (
    <AuthShell
      kicker={`Welcome, ${actor.user_name || 'there'}`}
      title="Set up your household"
      blurb="What the books are called, and the currency they are kept in. Set a budget for the month after this, and everything you record reports against it."
    >
      <div style={{ padding: '26px var(--gutter) 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SetupForm />

        <p style={{ margin: '4px 4px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Been invited to someone else&rsquo;s household instead? Open the link they sent you
          {actor.email ? <> — it is addressed to <strong>{actor.email}</strong></> : ''}.
        </p>

        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button type="submit" style={{
            minHeight: 44, padding: '0 6px', display: 'flex', alignItems: 'center',
            color: 'var(--c-meta)', fontSize: 'var(--step--1)', fontWeight: 600,
          }}>
            Sign out
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
