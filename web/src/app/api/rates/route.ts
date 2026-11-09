import { NextResponse } from 'next/server';
import { dueRateBases } from '@/db/holdings';
import { ensureRates } from '@/db/prices';
import { screenCaller } from '../guard';
/* Refreshing the day's rates, off the render path (v3.1 P5, perf row 8).

   Wealth renders with the last known rates and says which are over a day old; once the screen is on the phone it
   POSTs here, and if anything was refreshed it redraws (router.refresh). So the render — and a prefetch of it —
   makes no provider call and writes nothing, and the first open of the day no longer waits 300–500ms on two
   providers in a row.

   Who may ask: a signed-in member of a household, on this origin, at most six times a minute per household
   (screenCaller, ../guard.ts: currentActor → contextFor like every page, so a revoked session gets a 401 here too). What it may cause: fetching the market's price for the household's own bases, at
   most once a day per pair — price_quote is the guard (ensureRates), and a provider that failed is left alone for
   15 minutes. It writes only price_quote, which belongs to no household. A route handler rather than a Server
   Action, because an action queues with the router's navigations and this can take a provider's 4s budget.

   POST only: a GET could be prefetched or replayed by anything that follows links. */
export async function POST(req: Request) {
  /* Same origin, a signed-in member (a 401 otherwise, a 500 if the database is down), and six asks a minute per
     household (../guard.ts). */
  const actor = await screenCaller(req, 'rates', 6, 60);
  if (actor instanceof NextResponse) return actor;
  // What is due, read with the freshness check in one query inside the household's transaction; the providers
  // are asked only for that, with no second freshness read (P5 review M3).
  const due = await dueRateBases(actor.household_id, actor.currency);
  const { stale, refreshed } = due.length
    ? await ensureRates(actor.household_id, due, actor.currency, fetch, { due: true })
    : { stale: [], refreshed: [] };
  return NextResponse.json({ refreshed, stale }, { headers: { 'cache-control': 'no-store' } });
}
