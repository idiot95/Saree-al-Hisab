import { resetByToken } from '@/db/queries';
import { AuthShell, DeadEnd } from '../../auth-ui';
import ResetForm from './ResetForm';

export const metadata = { title: 'Set a new password · Quiet Ledger' };
export const dynamic = 'force-dynamic';

export default async function Reset({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reset = await resetByToken(token);

  if (!reset) {
    return <DeadEnd title="This link goes nowhere"
      body="Mistyped, most likely. Ask whoever owns your books to cut another one."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.used_at) {
    return <DeadEnd title="Already spent"
      body="A reset link works exactly once. If it was not you who spent it, ask for another one right now and change that password."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }
  if (reset.expired) {
    return <DeadEnd title="Too late"
      body="Reset links last a day, and this one did not survive it. Ask whoever owns your books for another."
      cta={{ href: '/signin', label: 'Sign in' }} />;
  }

  return (
    <AuthShell kicker={`For ${reset.name}, allegedly`} title="Right. A new one.">
      <div style={{ padding: '24px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <ResetForm token={token} />
        <p style={{ margin: '2px 4px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Setting it signs you straight in and kills this link — along with every other
          reset link anyone has issued you. Tidy.
        </p>
      </div>
    </AuthShell>
  );
}
