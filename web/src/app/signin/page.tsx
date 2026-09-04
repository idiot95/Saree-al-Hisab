import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { AuthShell, quietBtn } from '../auth-ui';
import SignInForm from './SignInForm';

export const metadata = { title: 'Sign in · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function SignIn() {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');

  return (
    <AuthShell
      title={<>Every rupee,<br />where you left it.</>}
    >
      <div style={{
        marginTop: 'auto', padding: '28px 20px 26px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <SignInForm />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-meta)', letterSpacing: '.04em' }}>
            NEW HERE
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
        </div>
        <a href="/signup" style={quietBtn}>Create an account</a>

        <p style={{
          margin: '6px 4px 0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
          color: 'var(--c-meta)',
        }}>
          Forgotten your password? The owner of your household can send you a reset link.
        </p>
      </div>
    </AuthShell>
  );
}
