import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { AuthShell, ErrorNote, quietBtn } from '../auth-ui';
import { passwordSignInOpenNow } from '@/lib/password-window';
import { signInErrorSentence } from '@/lib/signin-errors';
import SignInForm from './SignInForm';
import GoogleButton from './GoogleButton';
import ForgetDevice from './ForgetDevice';

export const metadata = { title: 'Sign in · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

export default async function SignIn({ searchParams }: {
  searchParams: Promise<{ e?: string | string[]; error?: string | string[] }>;
}) {
  const actor = await actorOrNull();
  if (actor?.household_id) redirect('/');

  const q = await searchParams;
  /* `e` is ours (a refusal or the cutoff); `error` is Auth.js's own, e.g. the
     person cancelled at Google. Only known codes get words. */
  const authError = typeof q.error === 'string' ? q.error : null;
  const note = signInErrorSentence(q.e)
    ?? (authError && authError !== 'CredentialsSignin' ? "Google sign-in didn't finish. Try again." : null);
  const passwordOpen = passwordSignInOpenNow();

  return (
    <AuthShell
      title={<>Every rupee,<br />where you left it.</>}
    >
      <div style={{
        marginTop: 'auto', padding: '28px var(--gutter) 26px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <ForgetDevice />
        {note && <ErrorNote>{note}</ErrorNote>}
        <GoogleButton />

        {passwordOpen && (
          /* Behind a link: Google is the way in, the password is the way out
             for anyone who has not linked yet. A native <details> so it opens
             without the bundle. */
          <details>
            <summary style={{
              listStyle: 'none', cursor: 'pointer', textAlign: 'center', padding: '12px 0',
              fontSize: 'var(--step--1)', fontWeight: 600, color: 'var(--foreground)',
              textDecoration: 'underline', textUnderlineOffset: 3,
            }}>
              Sign in with your password
            </summary>
            <div style={{ paddingTop: 6 }}><SignInForm /></div>
          </details>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '2px 0' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 'var(--step--2)', fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '.04em' }}>
            NEW HERE
          </span>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
        <a href="/signup" style={quietBtn}>Create an account</a>

        {passwordOpen && <p style={{
          margin: '6px 4px 0', fontSize: 'var(--step--1)', lineHeight: 1.5, textAlign: 'center',
          color: 'var(--muted-foreground)',
        }}>
          Forgotten your password? The owner of your household can send you a reset link.
        </p>}
      </div>
    </AuthShell>
  );
}
