'use server';

import { signIn } from '@/auth';

/* Anyone may sign up. What that gets you is an account and, on the next
   screen, your OWN household — never a way into somebody else's books, which
   still takes an invitation from them. That is the whole reason signing up
   can be open in the first place.

   Signing up is Google only: the account is whoever Google vouches for, and
   the signIn callback (src/auth.ts) creates it — or, for an address that
   already has books, refuses and says to link from Household. A password
   account is no longer made here; createAccount stays in db/membership for
   the invariants.

   The household is a separate step (/setup), because it asks a different
   kind of question — what to call the books and what currency they are in —
   and someone who was invited never answers it at all. /setup sends anyone
   who already has books straight on to them. */
export async function signUpWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/setup' });
}
