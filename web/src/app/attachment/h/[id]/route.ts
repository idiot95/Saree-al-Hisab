import { NextResponse } from 'next/server';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';
import { dispositionFor, isUuid, SERVE_HEADERS } from '@/lib/bills';

/* Serving a photo of a holding back: the jewellery on the scale, a valuation
   slip. Exactly /attachment/[id], for the other table: the bytes sit behind the
   same row-level security, the household is named by the session and never by
   the URL, and anything that is not this household's is a plain 404 — the same
   answer as for an id that never existed, so the route cannot be used to ask
   what another household keeps. Private, no-store, never sniffed. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse('Not found', { status: 404 });

  const actor = await currentActor().catch(() => null);
  if (!actor?.household_id) return new NextResponse('Not found', { status: 404 });

  const [row] = await withHousehold(actor.household_id, async () => sql`
    select a.name, a.mime, a.data from holding_attachment a
    where a.id = ${id} and a.household_id = ${actor.household_id}`);
  if (!row) return new NextResponse('Not found', { status: 404 });

  const bytes = row.data as Buffer;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': String(row.mime),
      'Content-Length': String(bytes.length),
      'Content-Disposition': dispositionFor(row.name, row.mime),
      ...SERVE_HEADERS,
    },
  });
}
