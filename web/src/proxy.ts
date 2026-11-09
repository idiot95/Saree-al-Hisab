import { NextResponse, type NextRequest } from 'next/server';
import { proxyAuth } from '@/auth.config';
import { clearOtherFlowCookies } from '@/lib/flow-cookies';

/* Two jobs, and one chore.

   1. A Content-Security-Policy with a fresh nonce per request. Next inlines a
      bootstrap script on every page, so a policy without a nonce would have to
      allow 'unsafe-inline' and be worth very little. With one, script-src is
      genuinely closed: nothing executes unless this server put it there.

   2. An optimistic redirect for a visitor with no session cookie, so they do
      not see a flash of the app before being sent to /signin. Next's own
      guidance is explicit that Proxy is NOT an authorisation boundary — the
      real check runs in the page, in every Server Action and in every route
      handler that reads the actor (contextFor, through src/db/queries.ts),
      where the cookie is dated against the account's session epoch and the
      role is read from the database. Here the cookie is only decrypted and
      verified (proxyAuth, src/auth.config.ts): a forged or expired one is
      redirected, a revoked one passes and is refused by the page. The proxy
      asks the database nothing — in production it runs at the edge region,
      a round trip (or a new TLS connection) away from Singapore.

   The chore: /signin?error= drops the Google flow cookies (see below).

   /api/auth, /signin, /signup, /join, /reset and /terms are excluded from the
   redirect: Auth.js has to answer, and opening your own household, accepting
   an invitation and setting a new password all have to work for someone who is
   not signed in yet — as does reading what they are agreeing to. */

/* Paths the redirect must never touch. /api/auth is Auth.js itself — sending
   an unauthenticated request there to /signin would break signing in, which is
   the one thing it exists to do. The rest are the doors someone has to be able
   to open before they have a session at all. */
const NO_REDIRECT = /^\/(api|signin|signup|join|reset|offline|terms)(\/|$)/;

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
    // Google sign-in posts to us and we redirect to Google; a no-JS form
    // submission follows that redirect, and form-action governs it.
    "form-action 'self' https://accounts.google.com",
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
    const session = await proxyAuth();
    if (!session?.user) {
      const to = req.nextUrl.clone();
      to.pathname = '/signin';
      to.search = '';
      return NextResponse.redirect(to);
    }
  }

  const res = NextResponse.next({ request: { headers } });
  /* A stored file is shown on its own, never as a page, so it gets the strictest policy there is rather
     than the page policy — and it gets it HERE, not only from the route: a path under /attachment/ that no
     route matches (a 404, a future route that forgets) still answers under default-src 'none'; sandbox. */
  res.headers.set('Content-Security-Policy',
    pathname.startsWith('/attachment/') ? "default-src 'none'; sandbox" : policy(nonce, dev));
  /* A sign-in that Auth.js gave up on — cancelled at Google, or refused
     before our callback ran — never reaches the code that spends the link and
     invite cookies, so they would outlive the attempt they were set for. It
     always lands here with ?error=, and a page cannot set cookies; this can. */
  if (pathname === '/signin' && req.nextUrl.searchParams.has('error')) {
    clearOtherFlowCookies(res.cookies);
  }
  return res;
}

export const config = {
  matcher: [
    /* Everything except static assets, which need no policy and no session.
       The manifest and the icons MUST be in this list: a browser fetches them
       while deciding whether the app can be installed, and an HTML redirect
       where JSON was expected means it simply cannot be. So must `fonts`:
       a font is fetched by the CSS engine, not by the page, and a redirect to
       /signin where a woff2 was expected is a silently missing typeface —
       which is how the Arabic line came back in a fallback face the first
       time this shipped.
       `icons/`, `brands/` and `fonts/` carry their slash too (P5 fix round 1), so a page that merely starts with
       the word — a future /brands-guide — still gets the proxy and its CSP.
       `api/capture/` (with its slash, so /api/captureX is still covered) is the SMS endpoint a phone posts to with a bearer token:
       no session to redirect for, JSON rather than a page so no CSP or nonce,
       and nothing here may set a cookie on it. */
    '/((?!_next/static|_next/image|icons/|brands/|fonts/|manifest.webmanifest|favicon.ico|sw.js|api/capture/).*)',
  ],
};
