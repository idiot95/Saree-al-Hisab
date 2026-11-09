import 'server-only';
import { NextResponse } from 'next/server';
import { currentActor } from '@/db/queries';
import { tooManyIn } from '@/db/rate-limit';
import { isControlFlow } from '@/lib/rethrow';

/* The door every POST route the screens call goes through (/api/rates, /api/sms/purge; v3.1 P5 fix round 1).

   The proxy lets all of /api/* through without a session (NO_REDIRECT), so a route handler under /api judges the
   caller itself:
     1. Same origin, as defence in depth beside SameSite=Lax: a browser's Sec-Fetch-Site must say same-origin, and
        without it the Origin must name this host. Cross-site → 403.
     2. Who: currentActor → contextFor, like every page, so a signed-out, revoked or household-less caller → 401.
        Only its redirect (control flow) means that; anything else — the database down — is rethrown, a 500.
     3. How often: `limit` calls per `window` seconds per household, in Postgres (rate_limit) → 429 with Retry-After.
   Returns the actor, or the response to send instead. */
export type ApiActor = Awaited<ReturnType<typeof currentActor>>;

export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try { return !!host && new URL(origin).host === host; } catch { return false; }
}

export async function screenCaller(req: Request, bucket: string, limit: number, windowSeconds: number):
  Promise<ApiActor | NextResponse> {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'cross-site' }, { status: 403 });
  let actor: ApiActor;
  try {
    actor = await currentActor();
  } catch (e) {
    if (isControlFlow(e)) return NextResponse.json({ error: 'signed out' }, { status: 401 });
    throw e;
  }
  const wait = await tooManyIn(`${bucket}:${actor.household_id}`, limit, windowSeconds);
  if (wait) {
    return NextResponse.json({ error: 'too many' }, { status: 429, headers: { 'Retry-After': String(wait) } });
  }
  return actor;
}
