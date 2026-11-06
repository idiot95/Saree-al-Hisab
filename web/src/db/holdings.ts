import 'server-only';
import { sql, withHousehold } from './client';
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
