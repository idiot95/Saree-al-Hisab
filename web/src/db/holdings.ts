import 'server-only';
import type { TransactionSql } from 'postgres';
import { sql, withHousehold } from './client';
import type { Bill } from '@/lib/bills';
import type { HoldingValue } from '@/lib/worth';

/* Holdings, read. Money figures arrive as strings, as postgres.js returns
   bigints. A value is null — never zero — when there is no snapshot or no
   rate: "we do not know" must not read as "worth nothing". */

export type HoldingRow = HoldingValue & {
  currency: string | null; metal: 'gold' | 'silver' | null; purity_permille: number | null;
  /** Minor units of the pot's currency, or milligrams of metal. */
  quantity: string | null; as_of: string | null;
  rate: string | null; rate_source: string | null; archived_at: string | null;
};
export type HoldingFull = HoldingRow & { household_id: string; created_at: string };
export type SnapshotRow = {
  id: string; as_of: string; quantity: string; note: string | null; created_by: string | null; created_at: string;
};

/** The household's live holdings with what each is worth today. Archived ones are left out. */
export async function holdingsFor(householdId: string): Promise<HoldingRow[]> {
  return withHousehold(householdId, async () => {
    return sql`
      select v.id, v.kind, v.name, v.owner_user_id, v.currency, v.metal,
             v.purity_permille, v.quantity::text as quantity, v.as_of::text as as_of,
             v.rate::text as rate, v.rate_source, v.rate_as_of::text as rate_as_of,
             v.value_minor::text as value_minor, v.archived_at::text as archived_at
      from holding_value v
      where v.household_id = ${householdId} and v.archived_at is null
      order by v.name, v.id
    ` as unknown as Promise<HoldingRow[]>;
  });
}

/** One holding of this household, archived or not, or null. */
export async function holdingById(householdId: string, id: string): Promise<HoldingFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return withHousehold(householdId, async () => {
    const [row] = await sql`
      select v.id, v.kind, v.name, v.owner_user_id, v.currency, v.metal,
             v.purity_permille, v.quantity::text as quantity, v.as_of::text as as_of,
             v.rate::text as rate, v.rate_source, v.rate_as_of::text as rate_as_of,
             v.value_minor::text as value_minor, v.archived_at::text as archived_at, v.household_id, h.created_at::text as created_at
      from holding_value v join holding h on h.id = v.id
      where v.id = ${id} and v.household_id = ${householdId}`;
    return (row as unknown as HoldingFull) ?? null;
  });
}

/** Every figure ever saved for a holding, newest first. */
export async function snapshotsFor(householdId: string, id: string): Promise<SnapshotRow[]> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return [];
  return withHousehold(householdId, async () => {
    return sql`
      select id, as_of::text as as_of, quantity::text as quantity, note, created_by, created_at::text as created_at
      from holding_snapshot
      where holding_id = ${id} and household_id = ${householdId}
      order by as_of desc
    ` as unknown as Promise<SnapshotRow[]>;
  });
}

/** The owner field of a form: '' is joint, otherwise a member of THIS household.
 *  Checked here because the id arrives from a POST; the database's trigger is
 *  the backstop, this is the sentence. */
export async function resolveOwner(
  householdId: string, raw: FormDataEntryValue | null,
): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  const v = String(raw ?? '').trim();
  if (v === '') return { ok: true, id: null };
  const [m] = /^[0-9a-f-]{36}$/i.test(v)
    ? await sql`select user_id from member where household_id = ${householdId} and user_id = ${v}`
    : [];
  return m ? { ok: true, id: v } : { ok: false, error: 'That person is not in this household.' };
}

export type PhotoRow = { id: string; name: string; mime: string; snapshot_id: string | null; created_at: string };

/** The photos and PDFs kept with a holding, newest first. NEVER the bytes: a
 *  list of thumbnails must not drag megabytes through the query. The bytes
 *  come out one at a time through /attachment/h/[id]. */
export async function photosFor(householdId: string, holdingId: string): Promise<PhotoRow[]> {
  if (!/^[0-9a-f-]{36}$/i.test(holdingId)) return [];
  return withHousehold(householdId, async () => {
    return sql`
      select id, name, mime, snapshot_id, created_at::text as created_at
      from holding_attachment
      where holding_id = ${holdingId} and household_id = ${householdId}
      order by created_at desc, id
    ` as unknown as Promise<PhotoRow[]>;
  });
}

/** Write already-validated photos inside the caller's transaction, so a photo
 *  never outlives a failed save. The composite keys make the database refuse a
 *  holding from another household or a snapshot from another holding. */
export async function insertPhotos(
  tx: TransactionSql, householdId: string, holdingId: string, snapshotId: string | null, userId: string, photos: Bill[],
): Promise<void> {
  for (const p of photos) {
    await tx`
      insert into holding_attachment (household_id, holding_id, snapshot_id, name, mime, bytes, data, created_by)
      values (${householdId}, ${holdingId}, ${snapshotId}, ${p.name}, ${p.mime}, ${p.buf.length}, ${p.buf}, ${userId})`;
  }
}

/** What the household's live holdings need a price for — each pot's currency,
 *  XAU for gold and XAG for silver — so the rates can be made fresh BEFORE the
 *  holdings are valued. Nothing but the codes. */
export async function holdingBases(householdId: string): Promise<string[]> {
  return withHousehold(householdId, async () => {
    const rows = await sql`
      select distinct case when kind = 'fx_cash' then currency
                           when metal = 'gold' then 'XAU' else 'XAG' end as base
      from holding
      where household_id = ${householdId} and archived_at is null`;
    return rows.map((r) => String(r.base)).filter(Boolean);
  });
}

/** The base a holding is priced in: its currency, or the metal's code. */
export const baseOf = (h: { kind: string; currency: string | null; metal: string | null }) =>
  h.kind === 'fx_cash' ? (h.currency ?? '') : h.metal === 'gold' ? 'XAU' : 'XAG';
