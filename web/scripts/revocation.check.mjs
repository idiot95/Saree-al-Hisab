/* A revoked session stays revoked, however often its cookie is refreshed.

   Auth.js re-stamps iat every time it re-encodes a cookie, and
   GET /api/auth/session re-encodes, so a revoked but unexpired cookie could
   once be refreshed into one that passed the session-epoch check. Sessions
   are now judged by authAt, set once at sign-in, and the jwt callback ends a
   revoked session instead of refreshing it (src/auth.ts).

   Since v3.1 P5 the proxy asks the database nothing: it only decrypts the cookie and checks its expiry
   (src/auth.config.ts `proxyAuth`), so a revoked cookie passes it and has to be refused by the authorisation
   boundary behind it, contextFor. This proves that it is, on all three kinds of door: a page (Activity, which lists
   a known entry), a Server Action (checkDuplicate, which returns a matching entry), and a route handler
   (/attachment/[id], with a throwaway bill this script inserts and deletes). The same cookie gets the data while
   fresh and none once revoked, and the revoked page's answer carries the page's CSP header, so it came from the
   page and not from the proxy. A forged and an expired cookie are still sent to /signin by the proxy itself.

   Needs a running server with password sign-in open and an account to sign in
   as (the seeded one by default). Moves that account's session epoch, which
   signs it out everywhere.

   Run: npx next start -p 3000, then
        NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/revocation.check.mjs     */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import postgres from 'postgres';
import { encode } from '@auth/core/jwt';
import { localOwnerUrl } from './local-only.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = localOwnerUrl(root);
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.CHECK_EMAIL ?? 'ammar@example.com';
const PASSWORD = process.env.CHECK_PASSWORD ?? 'Correct-horse-9';
const cookieHeader = (m) => [...m].map(([k, v]) => `${k}=${v}`).join('; ');
function take(res, m) {
  for (const c of res.headers.getSetCookie()) {
    const [kv, ...attrs] = c.split(';'); const i = kv.indexOf('=');
    const k = kv.slice(0, i).trim(), v = kv.slice(i + 1);
    if (!v || /expires=thu, 01 jan 1970/i.test(attrs.join(';')) || /max-age=0/i.test(attrs.join(';'))) m.delete(k); else m.set(k, v);
  }
}
const get = async (path, m) => { const r = await fetch(B + path, { headers: { cookie: cookieHeader(m) }, redirect: 'manual' }); take(r, m); return r; };
/* Signed in: Home opens (200), or sends a person with no books on to /setup or /no-household. Signed out, or a
   refused session: a redirect to /signin. (It asked /setup alone, which redirects anyone who has books — the seeded
   account included — so a good session read as signed out.) */
const signedIn = async (m) => {
  const r = await get('/', m);
  if (r.status === 200) return true;
  const to = r.headers.get('location') ?? '';
  return r.status >= 300 && r.status < 400 && new URL(to, B).pathname !== '/signin';
};
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

/* The three doors. A known entry (the account's latest expense with a merchant, this month so Activity lists it)
   and a throwaway bill on it. */
const [hit] = await sql`
  select t.id, t.household_id, t.amount, to_char(t.occurred_on, 'YYYY-MM-DD') as on, t.merchant
  from txn t join member m on m.household_id = t.household_id join app_user u on u.id = m.user_id
  where u.email = ${EMAIL} and u.active_household_id = t.household_id and t.kind = 'expense'
    and t.deleted_at is null and length(t.merchant) >= 4 and t.amount > 0
    and date_trunc('month', t.occurred_on) = date_trunc('month', now())
  order by t.occurred_on desc, t.created_at desc limit 1`;
if (!hit) { console.error('no expense with a merchant this month for', EMAIL, '— seed the books first'); process.exit(1); }
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000'
  + '1f15c4890000000d49444154789c6360f8cf0000000301010018dd8db00000000049454e44ae426082', 'hex');
const STAMP = `revocation-check-${Date.now()}.png`;
const [bill] = await sql`
  insert into attachment (household_id, txn_id, name, mime, bytes, data)
  values (${hit.household_id}, ${hit.id}, ${STAMP}, 'image/png', ${PNG.length}, ${PNG}) returning id`;
/* The action's id, from this build's manifest, so the check follows a rebuild. */
const manifest = JSON.parse(fs.readFileSync(join(root, '.next/server/server-reference-manifest.json'), 'utf8'));
const ACTION = Object.entries(manifest.node)
  .find(([, v]) => v.filename === 'src/app/add/actions.ts' && v.exportedName === 'checkDuplicate')?.[0];

const page = async (m) => {
  const r = await get('/entries', m);
  return { status: r.status, csp: r.headers.has('content-security-policy'), body: await r.text(),
    to: r.headers.get('location') ?? '' };
};
const action = async (m) => {
  const r = await fetch(B + '/add', { method: 'POST', redirect: 'manual', headers: {
    cookie: cookieHeader(m), 'next-action': ACTION, accept: 'text/x-component', origin: B,
    'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify([Number(hit.amount), hit.on]) });
  return { status: r.status, redirect: r.headers.get('x-action-redirect') ?? '', body: await r.text() };
};
const file = async (m) => {
  const r = await get(`/attachment/${bill.id}`, m);
  return { status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
};

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
try {
  ok(!!ACTION, 'checkDuplicate is in this build\'s action manifest');
  // Fresh, the same cookie reads all three doors.
  const p1 = await page(new Map(oldCopy));
  ok(p1.status === 200 && p1.body.includes(hit.merchant), `fresh: the page lists the entry (${p1.status})`);
  const a1 = await action(new Map(oldCopy));
  ok(a1.status === 200 && !a1.redirect && a1.body.includes(hit.merchant),
    `fresh: the Server Action returns the entry (${a1.status})`);
  const f1 = await file(new Map(oldCopy));
  ok(f1.status === 200 && f1.bytes.equals(PNG), `fresh: the route handler serves the bill (${f1.status})`);

  await sleep(1100);
  // What revokeSessions() does (src/db/membership.ts).
  await sql`update app_user set sessions_valid_from = now() where email = ${EMAIL}`;
  ok(!(await signedIn(new Map(oldCopy))), 'after revocation the old cookie is refused');

  // Revoked, the same cookie gets nothing from any of them.
  const p2 = await page(new Map(oldCopy));
  ok(!p2.body.includes(hit.merchant), 'revoked: the page shows no entry');
  /* Activity has a loading.tsx, so its frame is streamed before the page runs and the page's redirect arrives in
     the stream (Next's NEXT_REDIRECT digest, and a meta refresh for no script) rather than as a 307. */
  const streamed = p2.status === 200 && /NEXT_REDIRECT;replace;\/signin;/.test(p2.body);
  ok((p2.status >= 300 && p2.status < 400 && new URL(p2.to, B).pathname === '/signin') || streamed,
    `revoked: the page sends it to /signin (${p2.status}${streamed ? ', in the stream' : ' ' + p2.to})`);
  ok(p2.csp, 'revoked: and that answer is the page\'s (it carries the CSP the proxy adds to what it lets through)');
  const a2 = await action(new Map(oldCopy));
  ok(!a2.body.includes(hit.merchant), 'revoked: the Server Action returns no entry');
  ok(new URL(a2.redirect.split(';')[0] || 'x:', B).pathname === '/signin',
    `revoked: the Server Action redirects to /signin (${a2.status} ${a2.redirect})`);
  const f2 = await file(new Map(oldCopy));
  ok(f2.status === 404 && !f2.bytes.includes(PNG), `revoked: the route handler answers 404 (${f2.status})`);

  // The proxy itself still turns away a cookie that is not ours or has run out.
  const secret = fs.readFileSync(join(root, '.env.local'), 'utf8').match(/^AUTH_SECRET="?([^"\n]+)/m)?.[1]
    ?? process.env.AUTH_SECRET;
  const [{ id: uid }] = await sql`select id from app_user where email = ${EMAIL}`;
  const name = 'authjs.session-token';
  const now = Math.floor(Date.now() / 1000);
  const expired = await encode({ token: { userId: uid, authAt: now + 5 }, secret, salt: name, maxAge: -60 });
  const forged = [...oldCopy.get(name) ?? 'x'].reverse().join('');
  for (const [what, value] of [['an expired', expired], ['a forged', forged]]) {
    const r = await get('/entries', new Map([[name, value]]));
    const to = new URL(r.headers.get('location') ?? '/', B).pathname;
    ok(r.status === 307 && to === '/signin' && !r.headers.has('content-security-policy'),
      `${what} cookie is redirected to /signin by the proxy (${r.status} ${to})`);
  }
} finally {
  await sql`delete from attachment where id = ${bill.id} and name = ${STAMP}`;
}
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
