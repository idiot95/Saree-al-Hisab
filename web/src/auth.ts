import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import {
  findLoginUser, isLocked, recordFailedAttempt, recordSuccessfulLogin,
} from '@/db/membership';
import { verifyPassword, needsRehash, hashPassword, decoyHash } from '@/lib/password';

/* An address and a password, ours end to end — no third party between the
   household and its books.

   The token carries ONE fact: which app_user row this is. It deliberately does
   not carry the household or the role. Those are read from the database on
   every request (src/db/membership.ts), so that removing someone or dropping
   them to viewer takes effect immediately rather than whenever their token
   happens to expire.

   Env: AUTH_SECRET. That is the whole list.                                  */

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const email = String(raw?.email ?? '').trim().toLowerCase();
        const password = String(raw?.password ?? '');
        if (!email || !password) return null;

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
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      return session;
    },
  },
});

declare module 'next-auth' {
  interface Session {
    user: { id: string } & import('next-auth').DefaultSession['user'];
  }
}
