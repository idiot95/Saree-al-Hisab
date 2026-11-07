import { NextResponse } from 'next/server';
import { currentActor, purgeSmsBodies } from '@/db/queries';

/* The 30-day purge of forwarded messages' text, on the one path every member reliably takes: opening the app
   (v3.1 P5, p2-review N1). There is no scheduler, and the screens that purged — From SMS, the message screen — are
   ones a household can go weeks without opening, while Activity, the screen everyone opens, is prefetched and so may
   not write. `Housekeeping` in the root layout POSTs here once per page load, after the screen has settled; a
   POST is never prefetched. The capture endpoint, From SMS and the message screen still purge too.

   Judged like every page (currentActor → contextFor): a signed-out or revoked caller gets 401 and purges nothing.
   What it can cause is exactly `purgeSmsBodiesIn` on the caller's own household — text of drafts already decided,
   or older than 30 days, set to null — which any member's visit to From SMS already did. */
export async function POST() {
  const actor = await currentActor().catch(() => null);
  if (!actor?.household_id) return NextResponse.json({ error: 'signed out' }, { status: 401 });
  const purged = await purgeSmsBodies(actor.household_id);
  return NextResponse.json({ purged }, { headers: { 'cache-control': 'no-store' } });
}
