export { auth as proxy } from '@/auth';

/* An optimistic check only. Next's own guidance is explicit that Proxy is not
   a session-management or authorisation solution — so this exists to send a
   signed-out visitor to /signin without a flash of the app, and the real
   guard stays in the page and in every Server Action.

   /signup, /join and /reset are excluded on purpose: opening your own books,
   accepting an invitation and setting a new password all have to work for
   someone who is not signed in yet, which is the entire point of them. */
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|icons|manifest.webmanifest|favicon.ico|signin|signup|join|reset).*)'],
};
