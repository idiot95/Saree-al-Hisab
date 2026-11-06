#!/usr/bin/env node
/* Recording without signal, end to end (CLAUDE.md, "Recording without signal"), against a running PRODUCTION build
   (`next build && next start`: the worker caches what the build names).

     node scripts/offline-taps.mjs [--state file] [--keep] [--shots dir]

   Env: OFFLINE_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local.
   --state is a signed-in Playwright storage state (default .sweep-state.json).

   1. Online, the worker installs and activates and controls the page; its shell cache holds /offline, and Add Entry
      opened online leaves the pickers on the phone (ql.pickers.v1).
   2. The network is cut (context.setOffline). A screen asked for now — /entries — is answered by the worker with the
      cached /offline: Add Entry with the No connection banner.
   3. An expense typed there, for an amount no entry in the books has, is kept on the phone: one entry in ql.queue.v1 with a clientRef, listed under
      "Waiting for signal · 1", and nothing has reached the books.
   4. The network comes back. SyncQueue sends on `online`, on that same screen: the snack says the entry is in the
      books, the phone's queue is empty and nothing is listed as waiting. Exactly one row carries that client_ref.
      The refresh after sending turns the shell into the real Activity; Home lists the entry, /offline lists nothing.
   The row this run wrote is removed at the end (and the person's last way to pay put back) unless --keep. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const postgres = require('postgres');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.OFFLINE_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const KEEP = argv.includes('--keep');
const SHOTS = arg('--shots');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const sql = postgres(/^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(env)[1], { ssl: 'require', max: 1, onnotice: () => {} });

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const { defaultBrowserType, ...ios } = devices['iPhone 13']; void defaultBrowserType;
const VERSION = /const VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8'))[1];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...ios, viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 }, storageState: STATE });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

let ref = null;
let SHOWN = '';
let user = null;
try {
  /* ── 1. online: the worker, the shell, the pickers ───────────────────── */
  await page.goto(`${BASE}/add`);
  await page.getByLabel(/^Amount in/).waitFor();
  const hh = await page.evaluate(() => JSON.parse(localStorage.getItem('ql.pickers.v1') ?? 'null')?.householdId);
  assert.ok(hh, 'Add Entry opened online keeps the pickers on the phone');
  [user] = await sql`select u.id, u.last_paid_with from app_user u join member m on m.user_id = u.id where m.household_id = ${hh}
    order by (u.active_household_id = ${hh}) desc limit 1`;
  // RegisterSW waits 1.2s after the page settles; then install fetches /offline and everything it names.
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 5000); });
    }
    const keys = await caches.keys();
    const shell = keys.find((k) => k.startsWith('shell-'));
    const cached = shell ? !!(await (await caches.open(shell)).match('/offline')) : false;
    return { state: reg.active?.state, controlled: !!navigator.serviceWorker.controller, shell, cached };
  });
  assert.equal(sw.state, 'activated', 'the worker is active');
  assert.equal(sw.shell, `shell-${VERSION}`, `the shell cache is this version's (${VERSION})`);
  assert.ok(sw.cached, 'the shell holds /offline');
  if (!sw.controlled) await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the worker controls the page');
  await page.evaluate(() => localStorage.removeItem('ql.queue.v1'));
  ok(`online: worker ${sw.state} and in control, ${sw.shell} holds /offline, the pickers are on the phone`);

  /* ── 2. no signal: a screen asked for is the cached /offline ─────────── */
  await ctx.setOffline(true);
  const res = await page.goto(`${BASE}/entries`);
  assert.ok(res?.fromServiceWorker(), 'the answer came from the worker');
  await page.getByText(/^No connection\. Entries saved here stay on this phone/).waitFor({ timeout: 10000 });
  assert.match(await page.title(), /No connection/);
  const amount = page.getByLabel(/^Amount in/);
  await amount.waitFor();
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'offline-1-screen.png') });
  ok('offline: /entries is answered by the worker with the cached /offline — Add Entry under the No connection banner');

  /* ── 3. typed without signal: kept on the phone ──────────────────────── */
  const before = (await sql`select count(*)::int as n from txn where household_id = ${hh}`)[0].n;
  /* An amount nothing else in the books has, so Home's line for it can only be this run's entry. */
  const taken = new Set((await sql`select amount from txn where household_id = ${hh}`).map((r) => Number(r.amount)));
  let RUPEES = 0;
  for (let i = 0; i < 200 && !RUPEES; i++) { const r = 101 + Math.floor(Math.random() * 8800); if (!taken.has(r * 100)) RUPEES = r; }
  assert.ok(RUPEES, 'found an amount the books do not hold');
  SHOWN = `₹${RUPEES.toLocaleString('en-IN')}`;
  await amount.fill(String(RUPEES));
  await page.locator('[data-category-tile]').first().click();
  await page.locator('[data-save]').click();
  await page.getByText(/kept on this phone/).first().waitFor({ timeout: 10000 });
  const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]'));
  assert.equal(queued.length, 1, 'one entry in the queue');
  ref = queued[0].clientRef;
  assert.match(ref, /^[0-9a-f-]{36}$/, 'it carries a clientRef');
  assert.equal(queued[0].amountMinor, RUPEES * 100);
  const waiting = page.getByRole('region', { name: 'Waiting to be sent' });
  await waiting.getByRole('heading', { name: 'Waiting for signal · 1' }).waitFor();
  assert.equal((await sql`select count(*)::int as n from txn where household_id = ${hh}`)[0].n, before, 'nothing reached the books');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'offline-2-queued.png') });
  ok(`offline: ${SHOWN} kept on the phone (clientRef ${ref.slice(0, 8)}…), "Waiting for signal · 1", the books unchanged`);

  /* ── 4. signal back: the queue drains where it stands ────────────────── */
  /* The browser says `online` and SyncQueue sends at once, on this very screen: the worker served /offline at the
     address asked for (/entries), and SyncQueue only stands aside on /offline's own address and the sign-in screens. */
  await ctx.setOffline(false);
  await page.getByText('The entry kept on this phone is in the books.').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]').length === 0, null, { timeout: 10000 });
  await waiting.waitFor({ state: 'detached', timeout: 10000 });
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'offline-3-sent.png') });
  ok('signal back: SyncQueue sends at once — "The entry kept on this phone is in the books.", the queue empty, nothing waiting');
  const rows = await sql`select id, amount from txn where household_id = ${hh} and client_ref = ${ref}`;
  assert.equal(rows.length, 1, 'exactly one row carries the clientRef');
  assert.equal(Number(rows[0].amount), RUPEES * 100);
  assert.equal((await sql`select count(*)::int as n from txn where household_id = ${hh}`)[0].n, before + 1, 'one row more in the books, no more');
  /* SyncQueue's refresh after sending asks the server for the address on screen, so the cached shell gives way to
     the real Activity. Home lists the entry. */
  await page.getByRole('heading', { name: 'Activity', level: 1 }).waitFor({ timeout: 10000 });
  await page.goto(`${BASE}/`);
  await page.getByRole('heading', { name: /^(Today|Latest)$/ }).waitFor();
  assert.equal(await page.getByRole('region', { name: /^(Today|Latest)$/ }).getByText(SHOWN, { exact: true }).count(), 1,
    `Home lists this run's ${SHOWN}, once`);
  await page.goto(`${BASE}/offline`);
  await page.getByLabel(/^Amount in/).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Waiting to be sent' }).count(), 0, 'nothing is waiting any more');
  ok(`exactly one row carries that client_ref (${SHOWN}), one more row in the books; the screen becomes the real Activity, Home lists it once; /offline lists nothing waiting`);
  assert.deepEqual(errors, [], 'no page errors');
} finally {
  await browser.close();
  if (ref && !KEEP) {
    await sql`delete from txn where household_id is not null and client_ref = ${ref}`.catch((e) => console.error(e.message));
    if (user) await sql`update app_user set last_paid_with = ${user.last_paid_with} where id = ${user.id}`;
    console.log('  cleaned up the row this run wrote');
  }
  await sql.end();
}
console.log(`${n} passed`);
