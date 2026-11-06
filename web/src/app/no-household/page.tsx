import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { actorOrNull } from '@/db/queries';
import StartOwn from './StartOwn';
import Screen from '../Screen';
import { AuthShell } from '../auth-ui';
import { Icon } from '../Icon';

export const metadata = { title: 'No household · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Signed in and in nobody's books — almost always because they were removed.
   Two ways out, and neither of them is a back door into someone else's
   household: wait to be invited, or open your own. */
export default async function NoHousehold() {
  const actor = await actorOrNull();
  if (!actor) redirect('/signin');
  if (actor.household_id) redirect('/');

  return (
    <Screen>
      <AuthShell
        title="You are not in a household"
        blurb={<>Signed in as {actor.user_name || 'you'}. Ask someone to invite you to theirs, or start your own.</>}
      >
        {actor.email && (
          <div className="flex items-start gap-3 rounded-2xl bg-background p-4">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-accent text-accent-foreground">
              <Icon name="post" size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">Ask them to invite this email</span>
              <span className="text-base font-semibold [overflow-wrap:anywhere]">{actor.email}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                An invitation is tied to the email it is sent to.
              </span>
            </span>
          </div>
        )}

        <StartOwn />

        <form action={async () => { 'use server'; await signOut({ redirectTo: '/signin' }); }}>
          <button type="submit" className="flex min-h-11 items-center gap-2 px-1 text-sm font-semibold text-muted-foreground">
            <Icon name="logout" size={18} />Sign out
          </button>
        </form>
      </AuthShell>
    </Screen>
  );
}
