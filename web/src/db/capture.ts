import 'server-only';
import { randomBytes } from 'node:crypto';
import { identity, sql, withHousehold } from './client';
import { hashCaptureToken } from '@/lib/link-token';
import { bodyHash, type ParsedSms } from '@/lib/sms';

/* SMS capture: a phone forwards a bank message with a bearer token, and it
   becomes a draft. Never an entry — a person accepts it on Add first.

   A token is 256 random bits shown once; only its SHA-256 (hex, which is what
   capture_token.token_hash insists on) is stored, so a copy of the database
   opens nothing. capture_token is under a household-only policy with no
   unscoped branch, so the endpoint, which holds only the token, finds the
   household through capture_lookup() (0112) — the one security-definer door,
   returning at most one live row. Everything after that runs scoped. */

export type CaptureTokenRow = { id: string; user_id: string; household_id: string };

/** A new token for this person's phone. The plaintext is returned once and
 *  never again: the caller shows it and forgets it. The caller decides who may
 *  issue one (a member who is not a viewer). */
export async function createCaptureToken(userId: string, householdId: string, label: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await withHousehold(householdId, async () => {
    await sql`insert into capture_token (user_id, household_id, token_hash, label)
              values (${userId}, ${householdId}, ${hashCaptureToken(token)}, ${label.trim().slice(0, 40)})`;
  });
  return token;
}

/** Revoke one of this household's tokens. False when it is not this
 *  household's or was already revoked. */
export async function revokeCaptureToken(householdId: string, id: string): Promise<boolean> {
  return withHousehold(householdId, async () => {
    const rows = await sql`update capture_token set revoked_at = now()
                           where id = ${id} and household_id = ${householdId} and revoked_at is null
                           returning id`;
    return rows.length === 1;
  });
}

/** The live token this plaintext names, or null. Compared by hash lookup only. */
export async function lookupCaptureToken(token: string): Promise<CaptureTokenRow | null> {
  const [row] = await identity`select id, user_id, household_id from capture_lookup(${hashCaptureToken(token)})`;
  return (row as CaptureTokenRow | undefined) ?? null;
}

export type Draft = {
  sender: string | null;
  body: string;
  receivedAt: string | null;
  parsed: ParsedSms & { via: 'sms' | 'model' };
};

/** Store a draft. The same message twice (whitespace aside) is one draft: the
 *  second insert does nothing. A received_at more than a day ahead of the
 *  database's clock is a phone with the wrong time, and becomes now().
 *  `parsed` goes as JSON text cast to jsonb: sql.json() through the bundled
 *  build reached the driver unserialised (ERR_INVALID_ARG_TYPE). */
export async function insertDraft(householdId: string, userId: string, d: Draft): Promise<boolean> {
  return withHousehold(householdId, async () => {
    const rows = await sql`
      insert into sms_draft (household_id, user_id, sender, body, received_at, body_hash, parsed)
      values (${householdId}, ${userId}, ${d.sender}, ${d.body},
              coalesce(case when ${d.receivedAt}::timestamptz <= now() + interval '1 day'
                            then ${d.receivedAt}::timestamptz end, now()),
              ${bodyHash(d.body)}, ${JSON.stringify(d.parsed)}::jsonb)
      on conflict (household_id, body_hash) do nothing
      returning id`;
    return rows.length === 1;
  });
}

/** Mark the token used, under the household's own policy. */
export async function touchCaptureToken(householdId: string, id: string) {
  await withHousehold(householdId, async () => {
    await sql`update capture_token set last_used_at = now()
              where id = ${id} and household_id = ${householdId}`;
  });
}
