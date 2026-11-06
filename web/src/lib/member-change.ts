import type { Sql, TransactionSql } from 'postgres';

/* Removing a member, or dropping them to viewer, takes their phones' SMS capture keys with it, in the same
   statement run. capture_lookup (0113) already refuses a removed member's or a viewer's key, but only while that is
   true: re-invited months later, or raised back to adult, the old key — on a phone that may have been sold or lost —
   would start posting drafts again without anybody issuing a new one. Revoked here, it never answers again; a new
   phone needs a new key.

   These take the database handle rather than importing one, so the invariants script runs the very same
   statements against the real schema. Every one is scoped by household id as well as by the row policy. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = Sql<any> | TransactionSql<any>;

/** Revoke every live capture key this person holds for this household. Returns how many. */
export async function revokeMemberCaptureIn(db: Db, householdId: string, userId: string): Promise<number> {
  const rows = await db`
    update capture_token set revoked_at = now()
    where household_id = ${householdId} and user_id = ${userId} and revoked_at is null
    returning id`;
  return rows.length;
}

/** Take a person out of the household, and their capture keys with them. Their entries stay. */
export async function removeMemberIn(db: Db, householdId: string, userId: string): Promise<void> {
  await revokeMemberCaptureIn(db, householdId, userId);
  await db`delete from member where household_id = ${householdId} and user_id = ${userId}`;
}

/** Set a person's role; dropping to viewer revokes their capture keys (a viewer adds nothing). */
export async function changeRoleIn(db: Db, householdId: string, userId: string, role: 'owner' | 'adult' | 'viewer'): Promise<void> {
  await db`update member set role = ${role} where household_id = ${householdId} and user_id = ${userId}`;
  if (role === 'viewer') await revokeMemberCaptureIn(db, householdId, userId);
}
