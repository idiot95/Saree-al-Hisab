import NextAuth, { type NextAuthConfig } from 'next-auth';

/* The part of the Auth.js setup that needs no database: how the cookie is
   made and read, and what a session carries. src/auth.ts builds the real
   thing on it (the providers, the sign-in decisions, and the jwt callback
   that ends a revoked session against app_user.sessions_valid_from).

   `proxyAuth` is the proxy's: it decrypts and verifies the session cookie
   with AUTH_SECRET, so a forged, tampered or expired cookie is no session,
   and it asks the database nothing. That is all the proxy's redirect needs —
   the proxy is not the authorisation boundary. Revocation (Sign out
   everywhere, a password change, a removed member) is judged where it is:
   in contextFor, through src/db/queries.ts, on every page, every Server
   Action and every route handler that reads the actor, and in the full jwt
   callback (src/auth.ts) on /api/auth/session. A revoked cookie therefore
   passes the proxy and is refused one step later, by the page.

   Nothing here may import from src/db: the proxy runs in front of every
   request (at the edge region in production, far from the database), and
   a pool there costs a round trip — or a new TLS connection — per tap. */

export const authConfig = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,   // a phone should not ask every week
    updateAge: 24 * 60 * 60,
  },
  // Every Auth.js error lands on our sign-in screen, not its own page.
  pages: { signIn: '/signin', error: '/signin' },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.userId as string;
      /* When the person signed in, not when the cookie was last re-encoded
         (iat moves on every refresh). This is what lets the server refuse a
         session begun before the account's session epoch — see contextFor. */
      session.issuedAt = typeof token.authAt === 'number' ? token.authAt : 0;
      return session;
    },
  },
} satisfies NextAuthConfig;

/** The proxy's session reader: signature and expiry only, never the database. A cookie that decodes but names
 *  nobody is no session. It never writes a cookie (called bare, Auth.js only reads). */
export const { auth: proxyAuth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token }) {
      return typeof token.userId === 'string' && token.userId ? token : null;
    },
  },
});
