import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { unclaimedHousehold } from '@/db/membership';
import { AuthShell, quietBtn } from '../auth-ui';
import SignInForm from './SignInForm';

export const metadata = { title: 'Sign in · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function SignIn() {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');
  // Only offered while there is genuinely nobody in the books yet.
  const unclaimed = await unclaimedHousehold();

  return (
    <AuthShell
      title={<>Every rupee,<br />where you left it.</>}
      blurb="One set of books for your household. Budget a month, and everything reports against it."
    >
      <div style={{
        marginTop: 'auto', padding: '28px 20px 26px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <SignInForm />

        {unclaimed ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-meta)' }}>
                FIRST TIME HERE
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            </div>
            <a href="/setup" style={quietBtn}>Set up {unclaimed.name}</a>
          </>
        ) : (
          <p style={{
            margin: '6px 4px 0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
            color: 'var(--c-meta)',
          }}>
            No account? A household has to invite you — there is no way to sign yourself up
            into somebody&rsquo;s books. Forgotten your password? Ask the owner for a reset link.
          </p>
        )}
      </div>
    </AuthShell>
  );
}
