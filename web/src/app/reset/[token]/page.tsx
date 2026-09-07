import { resetByToken } from '@/db/queries';
import { AuthShell, DeadEnd } from '../../auth-ui';
import ResetForm from './ResetForm';

export const metadata = { title: 'Set a new password · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await resetByToken(token);

  if (!reset) {
    return <DeadEnd title="This link is not valid"
      body="Ask the owner of your household to send you a new one."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.used_at) {
    return <DeadEnd title="This link has been used"
      body="A reset link works once. If it was not you who used it, ask for another one now."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.expired) {
    return <DeadEnd title="This link has expired"
      body="Reset links last a day. Ask the owner of your household for a new one."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }

  return (
    <AuthShell kicker={`For ${reset.name}`} title="Set a new password">
      <div style={{ padding: '24px var(--gutter) 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ResetForm token={token} />
        <p style={{ margin: '2px 4px 0', fontSize: 'var(--step--2)', lineHeight: 1.5, color: 'var(--c-meta)' }}>
          This signs you in and cancels the link.
        </p>
      </div>
    </AuthShell>
  );
}
