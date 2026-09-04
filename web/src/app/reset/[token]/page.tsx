import { resetByToken } from '@/db/queries';
import { AuthShell, DeadEnd } from '../../auth-ui';
import ResetForm from './ResetForm';

export const metadata = { title: 'Set a new password · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await resetByToken(token);

  if (!reset) {
    return <DeadEnd title="This link does not lead anywhere"
      body="It may have been mistyped. Ask the owner of your household for a new one."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.used_at) {
    return <DeadEnd title="This link has been used"
      body="A reset link works once. If it was not you who used it, ask for another one straight away and change your password."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.expired) {
    return <DeadEnd title="This link has expired"
      body="Reset links last a day. Ask the owner of your household for a new one."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }

  return (
    <AuthShell kicker={`For ${reset.name}`} title="Choose a new password">
      <div style={{ padding: '24px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ResetForm token={token} />
        <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Setting it here signs you in and kills this link, along with any other reset link
          outstanding for you.
        </p>
      </div>
    </AuthShell>
  );
}
