import 'server-only';

/* Lives in src/db rather than src/lib because it is not pure: it reads request
   headers and writes to Postgres. src/lib stays free of both so it can be
   compiled and tested on its own. */
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { sql } from './client';

/* Who is asking, for rate-limiting purposes only.
   x-forwarded-for is set by the platform in front of us and can be forged when
   nothing is in front of us — which is exactly why this value is never used
   for authorisation, only for counting. It is hashed so the logs and the table
   never hold a bare address. */
async function caller(): Promise<string> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || h.get('x-real-ip')
    || 'local';
  return createHash('sha256').update(ip).digest('base64url').slice(0, 22);
}

/**
 * Count one attempt. Returns how long to wait, or null when it is allowed.
 * The window slides forward only when it has fully elapsed, so a burst cannot
 * keep pushing the deadline out.
 */
export async function tooMany(
  action: string, limit: number, windowSeconds: number,
): Promise<number | null> {
  const bucket = `${action}:${await caller()}`;
  const [row] = await sql`
    insert into rate_limit (bucket) values (${bucket})
    on conflict (bucket) do update
      set hits = case
            when rate_limit.window_start < now() - ${windowSeconds} * interval '1 second'
            then 1 else rate_limit.hits + 1 end,
          window_start = case
            when rate_limit.window_start < now() - ${windowSeconds} * interval '1 second'
            then now() else rate_limit.window_start end
    returning hits, extract(epoch from
      (window_start + ${windowSeconds} * interval '1 second') - now())::int as retry_in`;

  if (Number(row.hits) <= limit) return null;
  return Math.max(1, Number(row.retry_in));
}

/** Old buckets are noise. Cheap to clear, and not on the critical path. */
export async function pruneRateLimits() {
  await sql`delete from rate_limit where window_start < now() - interval '1 day'`;
}

export function waitMessage(seconds: number) {
  if (seconds < 90) return `Try again in ${Math.ceil(seconds)} seconds.`;
  return `Try again in ${Math.ceil(seconds / 60)} minutes.`;
}
