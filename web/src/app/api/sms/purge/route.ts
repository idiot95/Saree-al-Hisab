import { NextResponse } from 'next/server';
import { purgeSmsBodies } from '@/db/queries';
import { screenCaller } from '../../guard';

/* The 30-day purge of forwarded messages' text, on the one path every member reliably takes: opening the app
   (v3.1 P5, p2-review N1). There is no scheduler, and the screens that purged — From SMS, the message screen — are
   ones a household can go weeks without opening, while Activity, the screen everyone opens, is prefetched and so may
   not write. `Housekeeping` in the root layout POSTs here once per page load, after the screen has settled; a
   POST is never prefetched. The capture endpoint, From SMS and the message screen still purge too.

   Judged like every page (screenCaller, ../../guard.ts: same origin, currentActor → contextFor, six a minute per
   household): a signed-out or revoked caller gets 401 and purges nothing; a busy household gets 429, which costs
   nothing — the next open purges.
   What it can cause is exactly `purgeSmsBodiesIn` on the caller's own household — text of drafts already decided,
   or older than 30 days, set to null — which any member's visit to From SMS already did. */
export async function POST(req: Request) {
  const actor = await screenCaller(req, 'purge', 6, 60);
  if (actor instanceof NextResponse) return actor;
  const purged = await purgeSmsBodies(actor.household_id);
  return NextResponse.json({ purged }, { headers: { 'cache-control': 'no-store' } });
}
