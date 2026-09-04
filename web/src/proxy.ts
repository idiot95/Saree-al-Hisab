import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';

/* Two jobs, and only two.

   1. A Content-Security-Policy with a fresh nonce per request. Next inlines a
      bootstrap script on every page, so a policy without a nonce would have to
      allow 'unsafe-inline' and be worth very little. With one, script-src is
      genuinely closed: nothing executes unless this server put it there.

   2. An optimistic redirect for a visitor with no session cookie, so they do
      not see a flash of the app before being sent to /signin. Next's own
      guidance is explicit that Proxy is NOT an authorisation boundary — the
      real check runs in the page and in every Server Action, where the cookie
      is verified, dated against the account's session epoch, and the role is
      read from the database.

   /api/auth, /signin, /signup, /join and /reset are excluded from the
   redirect: Auth.js has to answer, and opening your own household, accepting
   an invitation and setting a new password all have to work for someone who is
   not signed in yet. */

/* Paths the redirect must never touch. /api/auth is Auth.js itself — sending
   an unauthenticated request there to /signin would break signing in, which is
   the one thing it exists to do. The rest are the doors someone has to be able
   to open before they have a session at all. */
const NO_REDIRECT = /^\/(api|signin|signup|join|reset)(\/|$)/;

function policy(nonce: string, dev: boolean) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonced bootstrap load Next's own chunks and
    // nothing else. eval is a dev-only requirement of the fast refresh runtime.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Every style in this app is an inline style attribute or a <style> Next
    // emits. There is no third-party CSS to allow.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: http:' : ''}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

export default async function proxy(req: NextRequest) {
  const dev = process.env.NODE_ENV !== 'production';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);

  const { pathname } = req.nextUrl;
  if (!NO_REDIRECT.test(pathname)) {
    const session = await auth();
    if (!session?.user) {
      const to = req.nextUrl.clone();
      to.pathname = '/signin';
      to.search = '';
      return NextResponse.redirect(to);
    }
  }

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', policy(nonce, dev));
  return res;
}

export const config = {
  matcher: [
    // Everything except static assets, which need no policy and no session.
    '/((?!_next/static|_next/image|icons|favicon.ico).*)',
  ],
};
