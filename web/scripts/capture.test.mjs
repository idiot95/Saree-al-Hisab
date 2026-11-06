/* POST /api/capture/sms, end to end against a running build.

   The endpoint is public and holds only a bearer token, so this checks what a
   hostile caller can learn from it: every refusal is a bare status code, and
   the body is empty or {} whatever happened. It makes its own household, an
   owner, a viewer and a removed member, issues their tokens straight into the
   table (as the owner role, which is how a token's hash would be written), and
   deletes all of it at the end.

   Run: npm run build && npx next start -p 3000, then
        NODE_TLS_REJECT_UNAUTHORIZED=0 node scripts/capture.test.mjs         */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { localOwnerUrl, assertLocal } from './local-only.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = readFileSync(join(root, '.env.local'), 'utf8');
const url = assertLocal(localOwnerUrl(root));
/* removeMember and changeRole run these statements (src/lib/member-change.ts); compiled as the lib tests compile
   them, so what is proved here is the action's own code. */
execFileSync('npx', ['tsc', '-p', 'tsconfig.lib.json'], { cwd: root, stdio: 'inherit' });
writeFileSync(join(root, '.libbuild/package.json'), '{"type":"module"}\n');
const { removeMemberIn, changeRoleIn } = await import(pathToFileURL(join(root, '.libbuild/member-change.js')).href);
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });
const B = process.env.BASE_URL ?? 'http://localhost:3000';
const EP = B + '/api/capture/sms';

const results = [];
const ok = (c, what) => { results.push(`${c ? 'ok  ' : 'FAIL'} ${what}`); };

const newToken = () => randomBytes(32).toString('base64url');
const hex = (t) => createHash('sha256').update(t).digest('hex');
const bodies = [];

async function post(body, { token, auth, headers = {} } = {}) {
  const h = { 'content-type': 'application/json', ...headers };
  if (auth !== undefined) h.authorization = auth;
  else if (token) h.authorization = `Bearer ${token}`;
  const r = await fetch(EP, { method: 'POST', headers: h, body, redirect: 'manual' });
  const text = await r.text();
  bodies.push({ status: r.status, text, r });
  return { status: r.status, text, r };
}

const HDFC = 'Sent Rs.450.00 From HDFC Bank A/c XX1234 To ZOMATO On 06/11/26 Ref 612345678901. Not you? Call 18002586161';
const OTP = '482913 is your OTP for txn of Rs 2,500.00 at TEST STORE on HDFC Bank card XX1234. Valid for 10 mins. Do not share it with anyone.';

const tag = randomBytes(4).toString('hex');
const [hh] = await sql`insert into household (name) values (${'capture test ' + tag}) returning id`;
const mk = async (who) => (await sql`
  insert into app_user (email, name) values (${`${who}.${tag}@capture.test`}, ${who}) returning id`)[0].id;
const owner = await mk('owner'), viewer = await mk('viewer'), gone = await mk('gone'), sara = await mk('sara');
await sql`insert into member (household_id, user_id, role) values
  (${hh.id}, ${owner}, 'owner'), (${hh.id}, ${viewer}, 'viewer'), (${hh.id}, ${sara}, 'adult')`;

const issue = async (userId, label, revoked = false) => {
  const t = newToken();
  const [row] = await sql`insert into capture_token (user_id, household_id, token_hash, label, revoked_at)
    values (${userId}, ${hh.id}, ${hex(t)}, ${label}, ${revoked ? sql`now()` : null}) returning id`;
  return { t, id: row.id };
};
const main = await issue(owner, 'main phone');
const burst = await issue(owner, 'burst phone');
const revoked = await issue(owner, 'old phone', true);
const view = await issue(viewer, 'viewer phone');
const removed = await issue(gone, 'removed phone');   // never a member of hh
const saraOld = await issue(sara, 'sara old phone');   // removed with her, then she is re-invited
const saraTwo = await issue(sara, 'sara phone two');   // dropped to viewer with her, then she is raised back
/* As the action runs them: inside one household-scoped transaction. */
const scoped = (fn) => sql.begin(async (tx) => { await tx`select set_config('app.household_id', ${hh.id}, true)`; return fn(tx); });
const saraKeys = [];
const drafts = async () => (await sql`select count(*)::int as n from sms_draft where household_id = ${hh.id}`)[0].n;

try {
  const json = JSON.stringify({ text: HDFC, sender: 'HDFCBK' });

  // ── who may call ──────────────────────────────────────────────────────
  ok((await post(json)).status === 401, 'no Authorization header → 401');
  for (const [what, auth] of [
    ['a bare "Bearer"', 'Bearer'],
    ['another scheme', `Basic ${main.t}`],
    ['a token of the wrong shape', 'Bearer not-a-token'],
    ['a token with a tail', `Bearer ${main.t} x`],
    ['no space after Bearer', `Bearer${main.t}`],
  ]) ok((await post(json, { auth })).status === 401, `malformed header (${what}) → 401`);
  ok((await post(json, { token: newToken() })).status === 401, 'an unknown token → 401');
  ok((await post(json, { token: revoked.t })).status === 401, 'a revoked token → 401');
  ok((await post(json, { token: view.t })).status === 401, "a viewer's token → 401");
  ok((await post(json, { token: removed.t })).status === 401, "the token of someone no longer a member → 401");
  ok(await drafts() === 0, 'and none of those stored anything');

  // ── a removed member's key stays dead when they come back ─────────────
  const saraMsg = (n) => JSON.stringify({ text: `Sent Rs.${n}.00 From HDFC Bank A/c XX1234 To ZOMATO On 06/11/26 Ref 7${tag}${n}.`, sender: 'HDFCBK' });
  ok((await post(saraMsg(11), { token: saraOld.t })).status === 202, "a contributing member's key → 202");
  await scoped((tx) => removeMemberIn(tx, hh.id, sara));
  ok((await post(saraMsg(12), { token: saraOld.t })).status === 401, 'removed (removeMember): her key → 401');
  await sql`insert into member (household_id, user_id, role) values (${hh.id}, ${sara}, 'adult')`;
  ok((await post(saraMsg(13), { token: saraOld.t })).status === 401, 're-invited as a contributing member: the old key is still 401');
  ok((await post(saraMsg(14), { token: saraTwo.t })).status === 401, 'and so is her other phone, revoked with her');
  ok((await sql`select count(*)::int as n from capture_token where user_id = ${sara} and household_id = ${hh.id} and revoked_at is null`)[0].n === 0,
    'removeMember revoked every key she held here');
  const saraThree = await issue(sara, 'sara new phone');
  ok((await post(saraMsg(15), { token: saraThree.t })).status === 202, 'a new key issued after she came back → 202');
  await scoped((tx) => changeRoleIn(tx, hh.id, sara, 'viewer'));
  await scoped((tx) => changeRoleIn(tx, hh.id, sara, 'adult'));
  ok((await post(saraMsg(16), { token: saraThree.t })).status === 401, 'dropped to viewer (changeRole) and raised back: that key → 401');
  ok(await drafts() === 2, 'only the two posts made while a key was good stored a draft');
  await sql`delete from sms_draft where household_id = ${hh.id}`;
  saraKeys.push(saraOld, saraTwo, saraThree);

  // ── what may be sent ──────────────────────────────────────────────────
  ok((await post('{"text":', { token: main.t })).status === 400, 'bad JSON → 400');
  ok((await post('[1,2]', { token: main.t })).status === 400, 'JSON of the wrong shape → 400');
  ok((await post(JSON.stringify({ text: '' }), { token: main.t })).status === 400, 'an empty text → 400');
  ok((await post(JSON.stringify({ text: HDFC, sender: 5 }), { token: main.t })).status === 400, 'a sender that is not a string → 400');
  ok((await post(JSON.stringify({ text: 'क'.repeat(2000) }), { token: main.t })).status === 413,
    '2000 Devanagari characters (6 KB of bytes, under the character limit) → 413');
  {
    // No Content-Length: the cap has to hold on the stream itself.
    const big = new TextEncoder().encode(JSON.stringify({ text: 'x'.repeat(1990) + 'क'.repeat(30) }));
    const stream = new ReadableStream({ start(c) { c.enqueue(big.slice(0, 1000)); c.enqueue(big.slice(1000)); c.close(); } });
    const r = await fetch(EP, { method: 'POST', body: stream, duplex: 'half', redirect: 'manual',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${main.t}` } });
    const text = await r.text(); bodies.push({ status: r.status, text, r });
    ok(r.status === 413, `a chunked body over 2048 bytes (${big.byteLength}) → 413`);
  }
  {
    // A body that trickles: half now, the rest after the five-second read deadline.
    const part = new TextEncoder().encode(JSON.stringify({ text: HDFC }));
    let sent = 0;
    const stream = new ReadableStream({ async pull(c) {
      if (sent === 0) { c.enqueue(part.slice(0, 20)); sent = 1; return; }
      await new Promise((r) => setTimeout(r, 6500));
      try { c.enqueue(part.slice(20)); c.close(); } catch { /* the server hung up */ }
    } });
    const r = await fetch(EP, { method: 'POST', body: stream, duplex: 'half', redirect: 'manual',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${main.t}` } }).catch(() => null);
    const text = r ? await r.text().catch(() => '') : '';
    if (r) bodies.push({ status: r.status, text, r });
    ok(r?.status === 400, `a body still arriving after five seconds → 400 (${r?.status})`);
  }
  ok(await drafts() === 0, 'and none of those stored anything');

  // ── a real message ────────────────────────────────────────────────────
  const first = await post(json, { token: main.t });
  ok(first.status === 202, 'a valid HDFC message → 202');
  const rows = await sql`select user_id, sender, body, parsed, status from sms_draft where household_id = ${hh.id}`;
  ok(rows.length === 1, 'exactly one sms_draft row');
  const p = rows[0]?.parsed ?? {};
  ok(p.amountMinor === 45000 && p.direction === 'debit' && p.currency === 'INR',
    `parsed amount and direction (${p.amountMinor} ${p.currency} ${p.direction})`);
  ok(rows[0]?.user_id === owner && rows[0]?.sender === 'HDFCBK' && rows[0]?.body === HDFC && rows[0]?.status === 'open',
    'the row carries the token\'s user, the sender, the body, and is open');
  const [used] = await sql`select last_used_at from capture_token where id = ${main.id}`;
  ok(used.last_used_at !== null, 'last_used_at is set');
  const [unused] = await sql`select last_used_at from capture_token where id = ${revoked.id}`;
  ok(unused.last_used_at === null, "and a refused token's is not");

  ok((await post(json, { token: main.t })).status === 202, 'the same POST again → 202');
  ok(await drafts() === 1, 'and still one row');
  const spaced = JSON.stringify({ text: HDFC.replace(/ /g, '  ') + '\n', sender: 'HDFCBK' });
  ok((await post(spaced, { token: main.t })).status === 202 && await drafts() === 1,
    'the same message with different whitespace is the same draft');

  const before = await drafts();
  ok((await post(JSON.stringify({ text: OTP, sender: 'HDFCBK' }), { token: main.t })).status === 202, 'an OTP → 202');
  ok(await drafts() === before, 'and zero new rows');
  const leak = await sql`select count(*)::int as n from sms_draft where body like ${'%482913%'}`;
  ok(leak[0].n === 0, 'the code is nowhere in sms_draft');

  const promo = JSON.stringify({ text: 'Get a pre-approved personal loan from Test Bank today. Apply now.' });
  ok((await post(promo, { token: main.t })).status === 202 && await drafts() === before + 1,
    'a message nothing parses in → 202, stored with what parsed');
  const [pr] = await sql`select parsed from sms_draft where household_id = ${hh.id} and body like 'Get a pre-approved%'`;
  ok(pr?.parsed?.direction === null && pr?.parsed?.amountMinor === null, 'and its direction and amount are null');

  const dated = async (text, at) => {
    await post(JSON.stringify({ text, received_at: at }), { token: main.t });
    const [r] = await sql`select received_at, now() - received_at as age from sms_draft
                          where household_id = ${hh.id} and body = ${text}`;
    return r;
  };
  const past = await dated('Rs 10.00 debited from A/c XX1234 at TEST CAFE', '2026-11-01T09:30:00+05:30');
  ok(past?.received_at?.toISOString() === '2026-11-01T04:00:00.000Z', 'a received_at the phone sends is kept');
  const ahead = await dated('Rs 11.00 debited from A/c XX1234 at TEST CAFE', '2099-01-01T00:00:00Z');
  ok(ahead && ahead.received_at.getFullYear() < 2099, 'a received_at far in the future becomes now()');

  // ── the thirty-day rule holds without anyone opening the app ─────────
  const [stale] = await sql`insert into sms_draft (household_id, user_id, sender, body, body_hash, created_at)
    values (${hh.id}, ${owner}, 'HDFCBK', 'Rs 12.00 debited, a month old', ${hex('stale ' + tag)}, now() - interval '31 days')
    returning id`;
  const [decided] = await sql`insert into sms_draft (household_id, user_id, sender, body, body_hash, status)
    values (${hh.id}, ${owner}, 'HDFCBK', 'Rs 13.00 debited, dismissed', ${hex('decided ' + tag)}, 'dismissed')
    returning id`;
  ok((await post(JSON.stringify({ text: 'Rs 14.00 debited from A/c XX1234 at TEST CAFE' }), { token: main.t })).status === 202,
    'a new message → 202');
  const purged = await sql`select id, body from sms_draft where id in (${stale.id}, ${decided.id})`;
  ok(purged.length === 2 && purged.every((r) => r.body === null),
    'and its arrival deleted the text of a 30-day-old draft and a dismissed one');

  // ── the method ────────────────────────────────────────────────────────
  for (const m of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const r = await fetch(EP, { method: m, headers: { authorization: `Bearer ${main.t}` }, redirect: 'manual' });
    const text = await r.text(); bodies.push({ status: r.status, text, r });
    ok(r.status === 405, `${m} → 405 (${r.status})`);
  }

  // ── rate limit: 60 an hour per token ─────────────────────────────────
  const same = JSON.stringify({ text: HDFC.replace('450.00', '451.00'), sender: 'HDFCBK' });
  let allowed = 0;
  for (let i = 0; i < 60; i++) if ((await post(same, { token: burst.t })).status === 202) allowed++;
  ok(allowed === 60, `60 requests in an hour are accepted (${allowed})`);
  ok((await post(same, { token: burst.t })).status === 429, 'the 61st → 429');
  ok((await post(json, { token: main.t })).status === 202, 'and another token is unaffected (per token, not per caller)');

  // ── nothing in any answer ────────────────────────────────────────────
  ok(bodies.every((b) => b.text === '' || b.text === '{}'),
    `every response body is empty or {} (${[...new Set(bodies.map((b) => JSON.stringify(b.text.slice(0, 40))))].join(', ')})`);
  ok(bodies.every((b) => b.r.headers.getSetCookie().length === 0), 'no response sets a cookie');
  ok(bodies.every((b) => ![...b.r.headers.keys()].some((k) => k.startsWith('access-control-'))), 'no response carries a CORS header');
  ok(bodies.every((b) => !b.r.headers.has('content-security-policy')), 'no response carries the page CSP');
  ok(bodies.every((b) => b.r.headers.get('location') === null), 'no response redirects');

  // ── the proxy skips exactly /api/capture/, nothing beside it ─────────
  const sms = await fetch(EP, { method: 'POST', redirect: 'manual', body: json,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${main.t}` } });
  ok(!sms.headers.has('content-security-policy') && sms.headers.getSetCookie().length === 0,
    '/api/capture/sms has no page CSP and sets no cookie');
  const near = await fetch(B + '/api/captureX', { redirect: 'manual' });
  ok(/nonce-/.test(near.headers.get('content-security-policy') ?? ''),
    `/api/captureX is still under the proxy: it carries the page CSP (${near.status})`);
} finally {
  await sql`delete from rate_limit where bucket in ${sql([main, burst, revoked, view, removed, saraOld, saraTwo, ...saraKeys].map((t) => `capture:${t.id}`))}`;
  await sql`delete from household where id = ${hh.id}`;            // cascades tokens and drafts
  await sql`delete from app_user where id in ${sql([owner, viewer, gone, sara])}`;
  await sql.end();
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
