import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global { var __sql: ReturnType<typeof postgres> | undefined; }

// One pool, reused across hot reloads in dev so a long session does not
// exhaust Neon's connection limit.
/* Which database this instance talks to.

   DATABASE_URL is whichever Neon store was connected to the project first, and
   a marketplace store cannot be renamed or moved between regions. APP_DATABASE_URL
   is therefore the explicit override: set it and the app follows, which makes
   changing region a configuration change rather than a race between
   disconnecting one store and connecting another. */
const connectionString = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL!;

const client = globalThis.__sql ?? postgres(connectionString, {
  ssl: 'require',
  max: 5,
  onnotice: () => {},
});
if (process.env.NODE_ENV !== 'production') globalThis.__sql = client;

export const db = drizzle(client, { schema });
export { client as sql };
