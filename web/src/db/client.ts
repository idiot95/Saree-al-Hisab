import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type TransactionSql } from 'postgres';
import * as schema from './schema';
import { isControlFlow } from '@/lib/rethrow';

declare global { var __sql: ReturnType<typeof postgres> | undefined; }

// One pool, reused across hot reloads in dev so a long session does not
// exhaust Neon's connection limit.
/* Which database this instance talks to, and as whom.

   DATABASE_URL is whichever Neon store was connected to the project first, and
   a marketplace store cannot be renamed or moved between regions. APP_DATABASE_URL
   is therefore the explicit override: set it and the app follows, which makes
   changing region a configuration change rather than a race between
   disconnecting one store and connecting another.

   It is also how the app gets off the owner role. Neon's owner carries
   BYPASSRLS, which makes every row-level policy a no-op for it; the policies
   in drizzle/0109 only bite when the connection is `saree_app`, a plain login
   role that owns nothing and cannot bypass anything. scripts/app-role.mjs
   makes that role and writes its URL here. */
const connectionString = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;

const pool = globalThis.__sql ?? postgres(connectionString, {
  ssl: 'require',
  max: 5,
  onnotice: () => {},
});
if (process.env.NODE_ENV !== 'production') globalThis.__sql = pool;

export const db = drizzle(pool, { schema });

/* ── one household at a time ────────────────────────────────────────────

   Every table that holds money is under row-level security (drizzle/0109):
   a row is visible, and may be written, only when `app.household_id` on the
   connection says so. That setting is transaction-local — set with
   set_config(…, true) it dies at COMMIT, so a pooled connection never carries
   one household's books into the next request.

   withHousehold() opens that transaction, sets the household, and runs the
   callback inside it. Inside, `sql` is the transaction; outside, `sql` throws,
   so a query that forgot its scope fails loudly in development rather than
   quietly returning nothing. The tables keyed by a person or a token rather
   than a household — app_user, member, household, invite, password_reset,
   rate_limit — are read before any household is known, through `identity`,
   which is the pool itself and carries no policy.

   Nested calls share the outer transaction, so a query helper that scopes
   itself can be called from an action that already has. A nested call for a
   different household is a bug, and says so. */
type Scope = { tx: TransactionSql<Record<string, never>>; household: string };
const scope = new AsyncLocalStorage<Scope>();

export async function withHousehold<T>(householdId: string, fn: () => Promise<T>): Promise<T> {
  const outer = scope.getStore();
  if (outer) {
    if (outer.household !== householdId) throw new Error('withHousehold: nested scope names a different household');
    return fn();
  }
  /* Three ways out of the callback, and each keeps its own meaning:
       · it resolved — commit, hand back the value;
       · it threw a redirect (Next's redirect() throws) — commit first, the
         writes before the redirect were meant, then let the redirect go;
       · it threw anything else — roll back, rethrow.
     And one the driver adds: a query inside failed, the app caught it and
     answered with its own message. postgres.js still rolls the transaction
     back and throws that error after the callback resolved, which is the
     right outcome for the data — nothing half-done survives — and the wrong
     one for the caller, who chose an answer. The answer stands. */
  let settled: { value: T } | { thrown: unknown } | undefined;
  try {
    await pool.begin(async (tx) => {
      await tx`select set_config('app.household_id', ${householdId}, true)`;
      try {
        settled = { value: await scope.run({ tx: tx as Scope['tx'], household: householdId }, fn) };
      } catch (e) {
        settled = { thrown: e };
        if (!isControlFlow(e)) throw e;
      }
    });
  } catch (e) {
    if (!settled) throw e;
    if ('thrown' in settled) throw settled.thrown;
  }
  if (!settled) throw new Error('withHousehold: the transaction ended without an answer');
  if ('thrown' in settled) throw settled.thrown;
  return settled.value;
}

/** The household this request is scoped to, or null outside any scope. */
export const scopedHousehold = () => scope.getStore()?.household ?? null;

function live(): Scope['tx'] {
  const s = scope.getStore();
  if (!s) {
    throw new Error('A query ran outside withHousehold(). Scope it to the household, or, for the '
      + 'tables keyed by a person or a token, use `identity` from db/client.');
  }
  return s.tx;
}

/* `sql` looks like the pool and behaves like the current transaction. A
   tagged template, sql({ … }) for a row, sql.json, sql.array all go to the
   transaction; sql.begin becomes a savepoint inside it, so an action that
   groups its writes keeps them grouped. */
export const sql: typeof pool = new Proxy(pool, {
  apply(_, __, args) {
    const tx = live();
    return Reflect.apply(tx as unknown as (...a: unknown[]) => unknown, tx, args);
  },
  get(_, prop) {
    const tx = live();
    if (prop === 'begin') {
      type Fn = (tx: Scope['tx']) => unknown;
      return (a: unknown, b?: unknown) => tx.savepoint((typeof a === 'function' ? a : b) as Fn);
    }
    const v = Reflect.get(tx, prop);
    return typeof v === 'function' ? v.bind(tx) : v;
  },
});

/** The pool, unscoped: for app_user, member, household, invite, password_reset
 *  and rate_limit — the rows that decide who is asking before any household
 *  is known. Nothing under a policy should be touched through this. */
export const identity = pool;
