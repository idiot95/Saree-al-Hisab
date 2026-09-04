import 'server-only';
import { sql } from './client';

export type Role = 'owner' | 'adult' | 'viewer';
export type Membership = { household_id: string; role: Role };

/* Where someone stands in a household is read from the database on every
   request, never carried in the session token. A JWT lives for weeks; being
   removed from a household, or dropped to viewer, has to take effect on the
   next tap — not at the next sign-in. The token therefore says only WHO the
   person is, and this module answers WHAT they may do. */

export async function membershipOf(userId: string): Promise<Membership | null> {
  const [m] = await sql`
    select household_id, role from member where user_id = ${userId} limit 1`;
  return (m as Membership | undefined) ?? null;
}

/** The Google identity, matched to the app_user row the ledger references. */
export async function upsertUserByEmail(email: string, name: string, image?: string | null) {
  const [existing] = await sql`select id from app_user where lower(email) = lower(${email})`;
  const id: string = existing?.id ?? (await sql`
    insert into app_user ${sql({ email, name, image: image ?? null })} returning id`)[0].id;
  await sql`
    update app_user set last_seen_at = now(), name = ${name},
      image = coalesce(${image ?? null}, image)
    where id = ${id}`;
  return id;
}

/** An open, unexpired invite addressed to THIS email — the only thing that
 *  puts someone into an existing household. The link never does: it is a way
 *  of showing the invitation, so a forwarded one admits nobody. */
export async function acceptInviteFor(userId: string, email: string): Promise<Membership | null> {
  const [inv] = await sql`
    select id, household_id, role from invite
    where lower(email) = lower(${email}) and status = 'open' and expires_at > now()
    order by created_at desc limit 1`;
  if (!inv) return null;

  await sql.begin(async (tx) => {
    await tx`insert into member ${tx({
      household_id: inv.household_id, user_id: userId, role: inv.role,
    })} on conflict do nothing`;
    await tx`update invite set status = 'accepted', accepted_at = now() where id = ${inv.id}`;
  });
  return { household_id: inv.household_id, role: inv.role as Role };
}

/** An unclaimed household is one nobody is a member of — the seed creates
 *  exactly that. The first person through the door owns it, and after that
 *  there is nothing left to claim.
 *
 *  It must also be SET UP: a household with no accounts is a shell left behind
 *  by a migration or a half-finished run, and landing the first person in one
 *  gives them an app with nothing in it and no way back out. */
async function claimUnclaimedHousehold(userId: string): Promise<Membership | null> {
  const [orphan] = await sql`
    select h.id from household h
    left join member m on m.household_id = h.id
    where m.household_id is null
      and exists (select 1 from account a where a.household_id = h.id)
    order by h.created_at limit 1`;
  if (!orphan) return null;
  await sql`insert into member ${sql({
    household_id: orphan.id, user_id: userId, role: 'owner',
  })} on conflict do nothing`;
  return { household_id: orphan.id, role: 'owner' };
}

/** Member already · invited · first through the door · nobody's books.
 *  Joining is deliberately not automatic: without the invite step, any Google
 *  account that found the URL would land inside someone's finances. */
export async function resolveMembership(userId: string, email: string): Promise<Membership | null> {
  return (await membershipOf(userId))
    ?? (await acceptInviteFor(userId, email))
    ?? (await claimUnclaimedHousehold(userId));
}
