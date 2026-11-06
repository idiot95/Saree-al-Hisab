import type { Sql, TransactionSql } from 'postgres';

/* What happens to a forwarded bank message after it lands: it is accepted (it
   became an entry), dismissed (it was nothing), or left open. In each case the
   raw text goes as soon as it is no longer needed — at once on a decision, and
   after thirty days whatever happens — because the parsed fields are all the
   books ever use, and the message itself is the most personal thing stored.

   These take the database handle rather than importing one, so the invariants
   script runs the very same statements against the real schema. Every one is
   scoped by household id as well as by the row policy. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = Sql<any> | TransactionSql<any>;

/** Mark an open draft as the entry it became, and drop its text. Run in the
 *  same transaction as the entry's insert, so the two land together or not at
 *  all. Only an entry for the amount the message said can accept it — or any
 *  amount, when no amount was read from it — so a draft id sent beside some
 *  unrelated entry closes nothing. False when there is no such open draft of
 *  this household: none by that id, one already decided, or one whose amount
 *  differs. */
export async function acceptDraftIn(
  db: Db, householdId: string, draftId: string, txnId: string, amountMinor: number,
): Promise<boolean> {
  const rows = await db`
    update sms_draft set status = 'accepted', txn_id = ${txnId}, body = null, decided_at = now()
    where id = ${draftId} and household_id = ${householdId} and status = 'open'
      and (jsonb_typeof(parsed->'amountMinor') is distinct from 'number'
           or (parsed->>'amountMinor')::numeric = ${amountMinor})
    returning id`;
  return rows.length === 1;
}

/** "This was nothing." The text goes at once; the parsed fields stay so an
 *  Undo can put it back. False when it is not this household's open draft. */
export async function dismissDraftIn(db: Db, householdId: string, draftId: string): Promise<boolean> {
  const rows = await db`
    update sms_draft set status = 'dismissed', body = null, decided_at = now()
    where id = ${draftId} and household_id = ${householdId} and status = 'open'
    returning id`;
  return rows.length === 1;
}

/** Undo, and only undo: a draft this household dismissed in the last quarter
 *  of an hour goes back to open. Its text is not coming back — it was deleted
 *  on the dismissal — but the figures it was read as are. */
export async function restoreDraftIn(db: Db, householdId: string, draftId: string): Promise<boolean> {
  const rows = await db`
    update sms_draft set status = 'open', decided_at = null
    where id = ${draftId} and household_id = ${householdId} and status = 'dismissed'
      and decided_at > now() - interval '15 minutes'
    returning id`;
  return rows.length === 1;
}

/** The thirty-day rule, without a scheduler: run at the start of the screens
 *  that list drafts. Text of anything decided, and of anything older than
 *  thirty days, is set to null. Returns how many lost their text. */
export async function purgeSmsBodiesIn(db: Db, householdId: string): Promise<number> {
  const rows = await db`
    update sms_draft set body = null
    where household_id = ${householdId} and body is not null
      and (status <> 'open' or created_at < now() - interval '30 days')
    returning id`;
  return rows.length;
}
