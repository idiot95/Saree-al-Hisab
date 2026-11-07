import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull } from '@/db/queries';
import { AuthShell, Small } from '../auth-ui';
import { Icon } from '../Icon';
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
      <SetupForm />

      <Small className="[overflow-wrap:anywhere]">
        Been invited to someone else&rsquo;s household instead? Open the link they sent you
        {actor.email ? <> — it is addressed to <strong className="text-foreground">{actor.email}</strong></> : ''}.
      </Small>

      <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
        <button type="submit" className="flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
          <Icon name="logout" size={18} />Sign out
        </button>
      </form>
    </AuthShell>
  );
}
