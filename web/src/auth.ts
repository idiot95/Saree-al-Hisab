import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { upsertUserByEmail, resolveMembership } from '@/db/membership';

/* Google is the whole of sign-in. It costs nothing, needs no SMS provider, and
   everyone in a household already has an account. Sessions are JWTs, so
   Auth.js keeps no tables of its own.

   The token carries ONE fact: which app_user row this is. It deliberately does
   not carry the household or the role — those are read from the database on
   every request (src/db/membership.ts), so that removing someone or dropping
   them to viewer takes effect immediately rather than whenever their token
   happens to expire.

   Env: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET.                      */

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, user }) {
      const email = user?.email ?? (token.email as string | undefined);
      if (user?.email) {
        const userId = await upsertUserByEmail(
          user.email, user.name ?? user.email, user.image);
        token.userId = userId;
        // Sign-in is also when an invitation is accepted, and when the very
        // first person claims the seeded household.
        await resolveMembership(userId, user.email);
      } else if (!token.userId && email) {
        // A token minted before this field existed.
        token.userId = await upsertUserByEmail(email, (token.name as string) ?? email, null);
      }
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
