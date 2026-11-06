import NextAuth, { type Profile, type User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { cookies } from 'next/headers';
import {
  acceptInviteAs, contextFor, createFromInviteGoogle, findLoginUser, isLocked, openInviteEmail,
  recordFailedAttempt, recordSuccessfulLogin,
} from '@/db/membership';
import {
  createGoogleUser, hasGoogle, identityUser, linkGoogle, sessionUser, userIdByEmail,
} from '@/db/identity';
import { verifyPassword, needsRehash, hashPassword, decoyHash } from '@/lib/password';
import { passwordSignInOpenNow } from '@/lib/password-window';
import { decideGoogleSignIn, type GoogleClaims } from '@/lib/google-signin';
import { gatherSignInFacts } from '@/lib/google-facts';
import { signInErrorPath } from '@/lib/signin-errors';
import { rethrowControlFlow } from '@/lib/rethrow';
import { INVITE_COOKIE, LINK_COOKIE } from '@/lib/flow-cookies';
import { looksLikeLinkToken } from '@/lib/link-token';

/* Two ways in: Google (the primary one), and an address and a password we
   hold ourselves until AUTH_PASSWORD_UNTIL.

   Which account a Google sign-in becomes is decided by decideGoogleSignIn
   (src/lib/google-signin.ts) from facts gathered here — never by matching the
   address, which is why allowDangerousEmailAccountLinking stays false and an
   address that already has books is told to sign in with its password and
   link from Household.

   The token carries ONE fact plus a timestamp: which app_user row this is, and
   when it was issued. It deliberately does not carry the household or the role. Those are read from the database on
   every request (src/db/membership.ts), so that removing someone or dropping
   them to viewer takes effect immediately rather than whenever their token
   happens to expire.

   Env: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, and optionally
   AUTH_PASSWORD_UNTIL (an ISO date; after it the password form is gone and
   a credentials POST is refused).                                           */

/* The link-intent cookie (set from Household when someone asks to link
   Google) and the invite cookie (set by "Accept with Google" on /join) are
   spent by the callback they were set for, whatever happens there. */

/** Where the invitation link has nothing left to give: its own page says
 *  why (used, withdrawn, expired). Only a token that looks like one of ours
 *  goes into the address. */
const deadInvitePath = (token: string) =>
  looksLikeLinkToken(token) ? `/join/${token}?e=1` : '/signin';

/** Who is signed in right now — only if the cookie is still honoured. A
 *  cookie older than the account's session epoch is nobody, so a revoked
 *  session can never be the one a Google account gets linked to. */
async function honouredSessionUser(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const c = await contextFor(id, session.issuedAt ?? 0);
  return c && !c.stale ? id : null;
}

/* The user objects a Google sign-in resolved to one of OUR accounts. jwt()
   refuses a Google sign-in whose user is not in here, so the token can never
   carry Google's own id (the provider's default user.id is the sub). */
const resolvedGoogle = new WeakSet<User>();

type PgError = { code?: string; constraint_name?: string };

/** Lost a race to a unique constraint: say what the constraint means. */
function raceRefusal(e: unknown) {
  const pg = e as PgError;
  if (pg?.code !== '23505') return null;
  console.error('google sign-in refused:', pg.code, pg.constraint_name ?? '');
  return pg.constraint_name === 'app_user_email_unique'
    ? signInErrorPath('exists-link-first')
    : signInErrorPath('already-linked');
}

async function googleSignIn(user: User, profile: Profile | undefined): Promise<boolean | string> {
  const jar = await cookies();
  const linkToken = jar.get(LINK_COOKIE)?.value;
  const inviteToken = jar.get(INVITE_COOKIE)?.value || undefined;
  try {
    const sub = typeof profile?.sub === 'string' ? profile.sub : '';
    const email = typeof profile?.email === 'string' ? profile.email.trim().toLowerCase() : '';
    if (!sub) return false;
    const claims: GoogleClaims = {
      sub, email, emailVerified: !!email && profile?.email_verified === true,
    };

    /* The invitation this sign-in is accepting, by the hash of its token. A
       cookie naming an invitation that is no longer open is not quietly
       dropped — that would turn "accept" into a bare account with no books —
       it goes back to the invitation's page, which says what happened. */
    let invite: { email: string } | null = null;
    if (inviteToken) {
      const invitedEmail = await openInviteEmail(inviteToken);
      if (!invitedEmail) return deadInvitePath(inviteToken);
      invite = { email: invitedEmail };
    }

    const facts = await gatherSignInFacts(claims, {
      identityUser, userIdByEmail, hasGoogle,
      sessionUserId: honouredSessionUser,
      linkIntentToken: linkToken,
      secret: process.env.AUTH_SECRET || undefined,
      nowMs: Date.now(),
      invite,
    });
    const d = decideGoogleSignIn(claims, facts);

    let userId: string;
    switch (d.kind) {
      case 'refuse':
        return signInErrorPath(d.code);
      case 'join-existing': {
        // Only reached with an open invite, so inviteToken is set.
        const joined = await acceptInviteAs(inviteToken!, d.userId, email);
        if (!joined) return deadInvitePath(inviteToken!);
        userId = d.userId;
        break;
      }
      case 'signin':
        userId = d.userId;
        break;
      case 'link':
        await linkGoogle(d.userId, sub, email);
        userId = d.userId;
        break;
      case 'create': {
        const name = typeof profile?.name === 'string' ? profile.name : '';
        if (inviteToken) {
          // The person, their Google identity, their place in the household
          // and the spent invitation: all in one transaction, or none of it.
          const made = await createFromInviteGoogle(inviteToken, sub, email, name);
          if (!made) return deadInvitePath(inviteToken);
          userId = made.userId;
        } else {
          const image = typeof profile?.picture === 'string' ? profile.picture : null;
          userId = await createGoogleUser(email, name, image, sub);
        }
        break;
      }
    }

    /* The session is the person as we hold them: our id, our address, our
       name. Nothing from Google but the decision it informed. */
    const u = await sessionUser(userId);
    if (!u) return false;
    user.id = u.id;
    user.email = u.email;
    user.name = u.name;
    user.image = u.image;
    resolvedGoogle.add(user);
    return true;
  } catch (e) {
    rethrowControlFlow(e);
    const refusal = raceRefusal(e);
    if (refusal) return refusal;
    const pg = e as PgError;
    // The code, the constraint and the error's class name — never a message,
    // which can carry the offending row.
    console.error('google sign-in failed:', pg?.code ?? 'unknown', pg?.constraint_name ?? '',
      (e as Error)?.name ?? '');
    return false;
  } finally {
    jar.delete(LINK_COOKIE);
    jar.delete(INVITE_COOKIE);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,   // a phone should not ask every week
    updateAge: 24 * 60 * 60,
  },
  // Every Auth.js error lands on our sign-in screen, not its own page.
  pages: { signIn: '/signin', error: '/signin' },
  providers: [
    Google({ allowDangerousEmailAccountLinking: false }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? '').trim().toLowerCase();
        const password = String(raw?.password ?? '');
        if (!email || !password) return null;
        // After the cutoff the form is gone; this is the door it led to.
        if (!passwordSignInOpenNow()) return null;

        const user = await findLoginUser(email);

        /* An unknown address must cost the same as a known one. Without this
           the difference between "no such account" and "wrong password" is a
           third of a second on a stopwatch, which is how you find out who
           banks here. */
        if (!user?.password_hash) {
          await verifyPassword(password, await decoyHash());
          return null;
        }
        if (isLocked(user)) return null;

        if (!(await verifyPassword(password, user.password_hash))) {
          await recordFailedAttempt(user.id);
          return null;
        }
        // Getting in is also when the cost gets raised on an older hash.
        await recordSuccessfulLogin(
          user.id, needsRehash(user.password_hash) ? await hashPassword(password) : null);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return true;
      return googleSignIn(user, profile);
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        // Only a sign-in that googleSignIn resolved to an app_user gets a token.
        if (!user || !resolvedGoogle.has(user) || !user.id) return null;
        token.userId = user.id;
        return token;
      }
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      /* Auth.js stamps iat on the token. Passing it through is what lets the
         server refuse a cookie that was issued before the account's session
         epoch — see sessionsValidFrom. */
      session.issuedAt = typeof token.iat === 'number' ? token.iat : 0;
      return session;
    },
  },
});

declare module 'next-auth' {
  interface Session {
    issuedAt: number;
    user: { id: string } & import('next-auth').DefaultSession['user'];
  }
}
