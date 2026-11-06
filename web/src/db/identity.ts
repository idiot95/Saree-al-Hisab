import 'server-only';
import { identity as sql } from './client';

/* Which app_user a Google account is. Keyed on Google's `sub`, never on the
   address: an address can be given up and re-issued to someone else, a sub
   cannot. All of this runs before any household is known, so it is on the
   `identity` pool and carries no household scope — auth_identity and app_user
   are person-keyed and under no policy. */

/** The person already holding this Google account, if anyone. */
export async function identityUser(sub: string): Promise<string | null> {
  const [r] = await sql`
    select user_id from auth_identity where provider = 'google' and subject = ${sub}`;
  return (r?.user_id as string | undefined) ?? null;
}

/** The account whose address this is. Stored addresses are lower-case (the
 *  email_is_lowercase check), so the lookup is too. */
export async function userIdByEmail(email: string): Promise<string | null> {
  const [r] = await sql`select id from app_user where email = ${email.trim().toLowerCase()}`;
  return (r?.id as string | undefined) ?? null;
}

export async function hasGoogle(userId: string): Promise<boolean> {
  const [r] = await sql`
    select 1 from auth_identity where provider = 'google' and user_id = ${userId}`;
  return !!r;
}

/** Ties a Google account to an existing person. The primary key and the
 *  (user_id, provider) unique are what stop a second link; a race that loses
 *  surfaces as a 23505 for the caller to word. */
export async function linkGoogle(userId: string, sub: string, email: string): Promise<void> {
  await sql`
    insert into auth_identity (user_id, provider, subject, email_at_link)
    values (${userId}, 'google', ${sub}, ${email.trim().toLowerCase()})`;
}

/** A new account that only Google can open: no password, no household yet.
 *  The person and their Google identity land together, or neither does. */
export async function createGoogleUser(
  email: string, name: string, image: string | null, sub: string,
): Promise<string> {
  const address = email.trim().toLowerCase();
  return sql.begin(async (tx) => {
    const [u] = await tx`
      insert into app_user (email, name, image)
      values (${address}, ${name.trim() || address.split('@')[0]}, ${image})
      returning id`;
    await tx`
      insert into auth_identity (user_id, provider, subject, email_at_link)
      values (${u.id}, 'google', ${sub}, ${address})`;
    return u.id as string;
  });
}

/** What a Google sign-in puts in the session: the person as we hold them,
 *  not as Google describes them. */
export async function sessionUser(userId: string) {
  const [u] = await sql`select id, email, name, image from app_user where id = ${userId}`;
  return (u as { id: string; email: string | null; name: string; image: string | null } | undefined) ?? null;
}
