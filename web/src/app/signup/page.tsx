import Link from 'next/link';
import { redirect } from 'next/navigation';
import { actorOrNull } from '@/db/queries';
import { AuthShell, quietBtn, Rule, Small } from '../auth-ui';
import GoogleButton from '../signin/GoogleButton';
import { signUpWithGoogle } from './actions';

export const metadata = { title: 'Create your account · Saree al-Hisab' };
export const dynamic = 'force-dynamic';

/* Open to anyone, and safely so: signing up gets you your own empty household
   and nothing else. There is no door here into somebody else's books — that
   still takes an invitation from them. */
export default async function SignUp() {
  const actor = await actorOrNull();
  if (actor) redirect(actor.household_id ? '/' : '/setup');

  return (
    <AuthShell
      title="Create your account"
      blurb="You, first. Your household — its name and its currency — is the next screen."
    >
      <GoogleButton action={signUpWithGoogle} />
      <Small className="text-xs">
        Continuing means agreeing to the{' '}
        <Link href="/terms" className="font-semibold text-primary underline underline-offset-[3px]">
          terms, and how your data is kept
        </Link>. Short, and every line of it can be checked.
      </Small>

      <Rule>Already have an account</Rule>
      <Link href="/signin" className={quietBtn}>Sign in</Link>

      <Small>
        Signing up gets you your own household. To join someone else&rsquo;s, you need an
        invitation from them.
      </Small>
    </AuthShell>
  );
}
