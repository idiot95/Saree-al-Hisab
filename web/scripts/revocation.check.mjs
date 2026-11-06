/* A revoked session stays revoked, however often its cookie is refreshed.

   Auth.js re-stamps iat every time it re-encodes a cookie, and
   GET /api/auth/session re-encodes, so a revoked but unexpired cookie could
   once be refreshed into one that passed the session-epoch check. Sessions
   are now judged by authAt, set once at sign-in, and the jwt callback ends a
   revoked session instead of refreshing it (src/auth.ts).

   Needs a running server with password sign-in open and an account to sign in
   as (the seeded one by default). Moves that account's session epoch, which
   signs it out everywhere.

   Run: npx next start -p 3000, then
        NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/revocation.check.mjs     */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = /^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(envFile)?.[1] ?? process.env.DATABASE_URL;
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.CHECK_EMAIL ?? 'ammar@example.com';
const PASSWORD = process.env.CHECK_PASSWORD ?? 'Correct-horse-9';
const jar = new Map();
const cookieHeader = (m) => [...m].map(([k, v]) => `${k}=${v}`).join('; ');
function take(res, m) {
  for (const c of res.headers.getSetCookie()) {
    const [kv, ...attrs] = c.split(';'); const i = kv.indexOf('=');
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1);
    if (!v || /expires=thu, 01 jan 1970/i.test(attrs.join(';')) || /max-age=0/i.test(attrs.join(';'))) m.delete(k); else m.set(k, v);
  }
}
const get = async (path, m) => { const r = await fetch(B + path, { headers: { cookie: cookieHeader(m) }, redirect: 'manual' }); take(r, m); return r; };
// /setup answers 200 to anyone signed in without books and redirects everyone else.
const signedIn = async (m) => { const r = await get('/setup', m); return r.status === 200; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn() {
  const m = new Map();
  const c = await get('/api/auth/csrf', m); const { csrfToken } = await c.json();
  const r = await fetch(B + '/api/auth/callback/credentials', { method: 'POST', redirect: 'manual',
    headers: { cookie: cookieHeader(m), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, email: EMAIL, password: PASSWORD, callbackUrl: B + '/' }) });
  take(r, m);
  return m;
}
const results = [];
const ok = (c, what) => { results.push(`${c ? 'ok  ' : 'FAIL'} ${what}`); };

// Fresh session: refresh keeps it working.
const fresh = await signIn();
ok(await signedIn(fresh), 'a fresh session opens a page');
await sleep(1100);
const s1 = await (await get('/api/auth/session', fresh)).json();
ok(!!s1?.user, 'GET /api/auth/session answers for a fresh session');
ok(await signedIn(fresh), 'and the refreshed cookie still opens a page');

// Revoked session: refresh must not resurrect it.
const old = await signIn();
const oldCopy = new Map(old);
await sleep(1100);
// What revokeSessions() does (src/db/membership.ts).
await sql`update app_user set sessions_valid_from = now() where email = ${EMAIL}`;
ok(!(await signedIn(new Map(oldCopy))), 'after revocation the old cookie is refused');
await sleep(1100);
const s2 = await (await get('/api/auth/session', old)).json().catch(() => null);
ok(!s2?.user, 'GET /api/auth/session with the revoked cookie returns no session');
ok(!(await signedIn(old)), 'and whatever cookie it handed back still opens nothing');
ok(!(await signedIn(new Map(oldCopy))), 'nor does the original cookie');
// A sign-in after the revocation works.
await sleep(1100);
const after = await signIn();
ok(await signedIn(after), 'a sign-in after the revocation works');
await get('/api/auth/session', after);
ok(await signedIn(after), 'and survives a refresh');
console.log(results.join('\n'));
await sql.end();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
