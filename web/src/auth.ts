import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { sql } from '@/db/client';

/* Google is the whole of sign-in. It costs nothing, needs no SMS provider, and
   everyone in a household already has an account. Sessions are JWTs, so
   Auth.js keeps no tables of its own — the Google identity is matched to the
   app_user row that the ledger already references, and the token carries that
   row's id.

   Env: AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_SECRET.                      */

export type Actor = {
  userId: string;
  householdId: string | null;
  role: 'owner' | 'adult' | 'viewer' | null;
};

/** Match a Google identity to a row in app_user, and work out whether they
 *  are in a household yet.
 *
 *  Joining is deliberately NOT automatic. The first person to sign in claims
 *  an unclaimed household; anyone else has to be invited. Without that rule,
 *  any Google account that found the URL would land inside your books. */
async function resolveActor(email: string, name: string, image?: string | null): Promise<Actor> {
  const [existing] = await sql`select id from app_user where email = ${email}`;
  const userId = existing?.id ?? (await sql`
    insert into app_user ${sql({ email, name, image: image ?? null })} returning id`)[0].id;

  await sql`update app_user set last_seen_at = now(), name = ${name},
            image = coalesce(${image ?? null}, image) where id = ${userId}`;

  const [member] = await sql`
    select household_id, role from member where user_id = ${userId} limit 1`;
  if (member) return { userId, householdId: member.household_id, role: member.role };

  // An unclaimed household is one nobody is a member of — the seed creates
  // exactly that. The first person through the door owns it.
  const [orphan] = await sql`
    select h.id from household h
    left join member m on m.household_id = h.id
    where m.household_id is null
    order by h.created_at limit 1`;
  if (orphan) {
    await sql`insert into member ${sql({ household_id: orphan.id, user_id: userId, role: 'owner' })}`;
    return { userId, householdId: orphan.id, role: 'owner' };
  }

  // Signed in, but not in anyone's books. They see the "ask for an invite"
  // screen rather than someone else's money.
  return { userId, householdId: null, role: null };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign-in, and again whenever the session is explicitly refreshed —
      // so accepting an invite takes effect without signing out.
      if (user?.email || trigger === 'update') {
        const email = user?.email ?? (token.email as string | undefined);
        if (email) {
          const actor = await resolveActor(email, user?.name ?? (token.name as string) ?? email, user?.image);
          token.userId = actor.userId;
          token.householdId = actor.householdId;
          token.role = actor.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.householdId = (token.householdId as string | null) ?? null;
      session.role = (token.role as Actor['role']) ?? null;
      return session;
    },
  },
});

declare module 'next-auth' {
  interface Session {
    householdId: string | null;
    role: 'owner' | 'adult' | 'viewer' | null;
    user: { id: string } & import('next-auth').DefaultSession['user'];
  }
}
