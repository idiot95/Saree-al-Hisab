import { resetByToken } from '@/db/queries';
import { AuthShell, DeadEnd, ErrorNote, Small } from '../../auth-ui';
import { passwordSignInOpenNow } from '@/lib/password-window';
import GoogleButton from '../../signin/GoogleButton';
import { linkGoogleWithReset } from '../actions';
import ResetForm from './ResetForm';

/* Read per request, like the page: after the cutoff this link sets no
   password, and the tab should not say it does. */
export function generateMetadata() {
  return {
    title: passwordSignInOpenNow()
      ? 'Set a new password · Saree al-Hisab'
      : 'Link your Google account · Saree al-Hisab',
  };
}
export const dynamic = 'force-dynamic';

export default async function Reset({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { token } = await params;
  const { e } = await searchParams;
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

  /* After the cutoff there is no password to set. The link is spent on the
     button, not on opening the page, and buys one thing: linking a Google
     account to the person it was issued for. */
  if (!passwordSignInOpenNow()) {
    return (
      <AuthShell kicker={`For ${reset.name}`} title="Link your Google account">
        <Small>
          Passwords have ended here. Choose your own Google account and it becomes how you
          sign in from now on.
        </Small>
        {e === 'wait' && <ErrorNote>Too many attempts. Try again in a few minutes.</ErrorNote>}
        {e === '1' && <ErrorNote>That did not work. Try again in a moment.</ErrorNote>}
        <GoogleButton action={linkGoogleWithReset} fields={{ token }} />
        <Small className="text-xs">
          This uses up the link and signs you out everywhere else. If you stop
          partway, ask the owner of your household for a new one.
        </Small>
      </AuthShell>
    );
  }

  return (
    <AuthShell kicker={`For ${reset.name}`} title="Set a new password">
      <ResetForm token={token} />
      <Small className="text-xs">This signs you in and cancels the link.</Small>
    </AuthShell>
  );
}
