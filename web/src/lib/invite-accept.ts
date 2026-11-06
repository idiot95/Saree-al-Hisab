import type { Sql, TransactionSql } from 'postgres';
import { hashLinkToken } from './link-token.ts';

/* Spending an invitation, in one place. Every way of accepting one — a new
   account with a password, a new account with Google, an account that
   already exists — goes through lockOpenInvite, so "open, in date, not
   revoked, used once" is one query and not three that drift apart.

   It takes the database handle rather than importing one, so the invariants
   script can run the very same code against the real schema. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = TransactionSql<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = Sql<any>;

export type LockedInvite = {
  id: string; household_id: string; email: string; role: 'adult' | 'viewer';
};

/** The invitation this link opens, locked until the transaction ends — only
 *  while it is open and in date, and, when `email` is given, only for the
 *  address it was written to. A used, revoked or expired link is null. */
export async function lockOpenInvite(
  tx: Tx, token: string, email?: string,
): Promise<LockedInvite | null> {
  const [inv] = await tx`
    select id, household_id, lower(email) as email, role from invite
    where token_hash = ${hashLinkToken(token)}
      ${email === undefined ? tx`` : tx`and lower(email) = ${email.trim().toLowerCase()}`}
      and status = 'open' and expires_at > now()
    for update`;
  return (inv as LockedInvite | undefined) ?? null;
}

/** The address an invitation is waiting for, while it is open and in date.
 *  No lock: this only informs the sign-in decision, and spending the
 *  invitation re-checks everything under one. */
export async function openInviteEmailIn(sql: Db, token: string): Promise<string | null> {
  const [r] = await sql`
    select lower(email) as email from invite
    where token_hash = ${hashLinkToken(token)}
      and status = 'open' and expires_at > now()`;
  return (r?.email as string | undefined) ?? null;
}

/* A new account starts its session epoch at 1970, not now(): it has no
   earlier session to revoke, and now() carries microseconds while the token
   minted a moment later carries whole seconds — so the very first session
   read as issued before the epoch, i.e. revoked, and the person landed back
   on /signin. Found by driving the callback end to end. */
/** A person who arrives through an invitation with a Google account and no
 *  account here: they, their Google identity and their place in the household
 *  land together, and the invitation is spent doing it — all, or none.
 *  Null when the invitation is no longer open or was written to another
 *  address. A lost race to an existing address or Google account surfaces as
 *  Postgres's 23505 for the caller to word. */
export async function createFromInviteGoogleIn(
  sql: Db, token: string, sub: string, email: string, name: string,
): Promise<{ userId: string; householdId: string } | null> {
  const address = email.trim().toLowerCase();
  return sql.begin(async (tx) => {
    const inv = await lockOpenInvite(tx, token, address);
    if (!inv) return null;
    const [u] = await tx`
      insert into app_user (email, name, active_household_id, sessions_valid_from)
      values (${address}, ${name.trim() || address.split('@')[0]}, ${inv.household_id},
              to_timestamp(0))
      returning id`;
    await tx`
      insert into auth_identity (user_id, provider, subject, email_at_link)
      values (${u.id}, 'google', ${sub}, ${address})`;
    await tx`insert into member ${tx({
      household_id: inv.household_id, user_id: u.id, role: inv.role,
    })}`;
    await tx`update invite set status = 'accepted', accepted_at = now() where id = ${inv.id}`;
    return { userId: u.id as string, householdId: inv.household_id };
  }) as Promise<{ userId: string; householdId: string } | null>;
}
