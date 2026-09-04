import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { AuthShell, quietBtn } from '../auth-ui';
import SignUpForm from './SignUpForm';

export const metadata = { title: 'Start your books · Quiet Ledger' };
export const dynamic = 'force-dynamic';

/* Open to anyone, and safely so: signing up gets you your own empty household
   and nothing else. There is no door here into somebody else's books — that
   still takes an invitation from them. */
export default async function SignUp() {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');

  return (
    <AuthShell
      title="Start your household"
      blurb="Set a budget for the month, and everything you record reports against it."
    >
      <div style={{ padding: '26px 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SignUpForm />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-meta)', letterSpacing: '.04em' }}>
            ALREADY HAVE AN ACCOUNT
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
        </div>
        <a href="/signin" style={quietBtn}>Sign in</a>

        <p style={{ margin: '4px 4px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--c-meta)' }}>
          Signing up creates your own household. To join someone else&rsquo;s, you need an
          invitation from them.
        </p>
      </div>
    </AuthShell>
  );
}
