import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { unclaimedHousehold } from '@/db/membership';
import { AuthShell, DeadEnd } from '../auth-ui';
import SetupForm from './SetupForm';

export const metadata = { title: 'Set up · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Open exactly once in the life of a household: the first person through the
   door owns the books, and claiming them is what closes this door behind you.
   Nobody can sign themselves up after that — an owner has to invite them. */
export default async function Setup() {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');

  const unclaimed = await unclaimedHousehold();
  if (!unclaimed) {
    return (
      <DeadEnd
        title="These books already have an owner"
        body="Nobody can sign themselves up into a household. Ask whoever keeps it to send you an invitation."
        cta={{ href: '/signin', label: 'Sign in' }}
      />
    );
  }

  return (
    <AuthShell
      kicker="Nobody has claimed these books yet"
      title={`Set up ${unclaimed.name}`}
      blurb="You will be the owner: the one who can invite the rest of the household and decide what each of them can do."
    >
      <div style={{ padding: '26px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SetupForm />
        <p style={{
          margin: '4px 4px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)',
        }}>
          Your password is stored only as a scrypt hash — not by us, not by anyone. Which also
          means nobody can recover it for you: if you forget it, another owner has to hand you
          a reset link.
        </p>
      </div>
    </AuthShell>
  );
}
