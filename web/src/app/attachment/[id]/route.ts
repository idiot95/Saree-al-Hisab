import { NextResponse } from 'next/server';
import { sql, withHousehold } from '@/db/client';
import { currentActor } from '@/db/queries';

/* Serving a bill back.

   The bytes are in Postgres behind the same row-level security as the entry
   they belong to, so this route is the only way out and it goes through the
   household scope like every other read — there is no signed URL to leak and
   no bucket to leave open. Private, no-store: a bill is not something to sit
   in a shared cache. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse('Not found', { status: 404 });

  const actor = await currentActor().catch(() => null);
  if (!actor?.household_id) return new NextResponse('Not found', { status: 404 });

  const [row] = await withHousehold(actor.household_id, async () => sql`
    select a.name, a.mime, a.data from attachment a
    join txn t on t.id = a.txn_id and t.deleted_at is null
    where a.id = ${id} and a.household_id = ${actor.household_id}`);
  if (!row) return new NextResponse('Not found', { status: 404 });

  const bytes = row.data as Buffer;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': String(row.mime),
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="${String(row.name).replace(/["\\]/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
