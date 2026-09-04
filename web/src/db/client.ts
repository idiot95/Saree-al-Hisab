import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global { var __sql: ReturnType<typeof postgres> | undefined; }

// One pool, reused across hot reloads in dev so a long session does not
// exhaust Neon's connection limit.
const client = globalThis.__sql ?? postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  max: 5,
  onnotice: () => {},
});
if (process.env.NODE_ENV !== 'production') globalThis.__sql = client;

export const db = drizzle(client, { schema });
export { client as sql };
