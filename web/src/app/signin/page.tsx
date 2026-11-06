import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { AuthShell, ErrorNote, quietBtn, quietLink, Rule, Small } from '../auth-ui';
import { cn } from '@/lib/utils';
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
    <AuthShell title={<>Every rupee,<br />where you left it.</>}>
      <ForgetDevice />
      {note && <ErrorNote>{note}</ErrorNote>}
      <GoogleButton />

      {passwordOpen && (
        /* Behind a link: Google is the way in, the password is the way out
           for anyone who has not linked yet. A native <details> so it opens
           without the bundle. */
        <details className="group">
          <summary className={cn(quietLink, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
            Sign in with your password
          </summary>
          <div className="pt-1.5"><SignInForm /></div>
        </details>
      )}

      <Rule>New here</Rule>
      <a href="/signup" className={quietBtn}>Create an account</a>

      {passwordOpen && (
        <Small className="text-center">
          Forgotten your password? The owner of your household can send you a reset link.
        </Small>
      )}
    </AuthShell>
  );
}
