#!/usr/bin/env node
/* Loans (/people, /tab/[id]), against a running build.

     node scripts/loans-taps.mjs [--state file] [--keep]

   Env: LOANS_BASE (default http://localhost:3000), LOANS_EMAIL (default ammar@example.com).
   Reads OWNER_DATABASE_URL from .env.local. --state is a signed-in Playwright storage state for an owner or
   contributing member (default .sweep-state.json).

   1. /people shows "Owed to you" as a figure and the open tab with the most still owed as a row; the row opens
      the tab's screen.
   2. Money back on the tab, ₹100 from whoever is first: the "Still to come back" figure drops by exactly ₹100 and
      a claim_receipt of 10000 is in the books.
   3. Back on /people, "Owed to you" has dropped by the same ₹100.
   4. A tab row swipes open (a finger dragged left) to Remind and Add cost, and closes again on Escape; shut, its
      action layer is not drawn at all (the dark-theme edge). The grip opens and closes it too.
   The receipts this run recorded are removed afterwards, unless --keep.                                          */
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
const BASE = (process.env.LOANS_BASE || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.LOANS_EMAIL || 'ammar@example.com';
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const KEEP = argv.includes('--keep');

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const sql = postgres(/^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(env)[1], { ssl: 'require', max: 1, onnotice: () => {} });

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const strip = (d) => { const { defaultBrowserType, ...rest } = d; void defaultBrowserType; return rest; };
const IOS = { ...strip(devices['iPhone 13']), viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...IOS, storageState: STATE });
/* No first-visit peek: it would slide a row out on its own while the test is measuring it. */
await ctx.addInitScript(() => { try { localStorage.setItem('swipe-peeked', '1'); } catch { /* none */ } });
const page = await ctx.newPage();

/* "₹9,000" / "+₹9,000" → 900000 minor units. */
const minor = (label) => Math.round(Number(String(label).replace(/[^0-9.]/g, '')) * 100);
const figureIn = (region) => region.getByRole('img').first();

const started = new Date();
let hh = null;
let tabId = null;

try {
  [{ hh }] = await sql`select active_household_id as hh from app_user where lower(email) = lower(${EMAIL})`;
  const [tab] = await sql`select b.id, b.name, coalesce(sum(tb.outstanding), 0)::bigint as out
    from ledger_book b join tab_balance tb on tb.book_id = b.id
    where b.household_id = ${hh} and b.closed_at is null
    group by b.id, b.name having coalesce(sum(tb.outstanding), 0) >= 10000 order by 3 desc limit 1`;
  assert.ok(tab, 'an open tab with at least ₹100 still owed (seed with --activity)');
  tabId = tab.id;

  /* ── 1. the list ──────────────────────────────────────────────────── */
  await page.goto(`${BASE}/people`);
  await page.getByRole('heading', { name: 'Loans', level: 1 }).waitFor();
  const hero = page.getByRole('region', { name: 'Owed to you' });
  const owedBefore = minor(await figureIn(hero).getAttribute('aria-label'));
  await page.getByRole('button', { name: 'New tab' }).waitFor();
  const row = page.getByRole('link', { name: new RegExp(tab.name) });
  await row.click();
  await page.waitForURL((u) => u.pathname === `/tab/${tabId}`);
  await page.getByRole('heading', { name: tab.name, level: 1 }).waitFor();
  ok(`/people: "Owed to you" ${owedBefore / 100}, the "New tab" button, and "${tab.name}" opens its tab`);

  /* ── 2. money back ────────────────────────────────────────────────── */
  const still = page.getByRole('region', { name: 'Still to come back' });
  const before = minor(await figureIn(still).getAttribute('aria-label'));
  assert.equal(before, Number(tab.out), 'the tab figure is what the books say is outstanding');
  await page.getByRole('button', { name: 'Money back' }).click();
  const sheet = page.getByRole('dialog', { name: 'Money back' });
  await sheet.getByLabel(/^Amount/).fill('100');
  await sheet.getByRole('button', { name: 'Record what came back' }).click();
  await page.waitForFunction(([want]) => {
    const r = document.querySelector('section[aria-label="Still to come back"] [role=img]');
    const v = r && Math.round(Number(r.getAttribute('aria-label').replace(/[^0-9.]/g, '')) * 100);
    return v === want;
  }, [before - 10000], { timeout: 20000 });
  const got = await sql`select t.amount::bigint as amount from txn t join claim c on c.id = t.claim_id
    join txn o on o.id = c.txn_id
    where t.household_id = ${hh} and t.kind = 'claim_receipt' and o.book_id = ${tabId}
      and t.created_at >= ${started} and t.deleted_at is null`;
  assert.equal(got.reduce((s, r) => s + Number(r.amount), 0), 10000, 'one ₹100 of claim_receipt in the books');
  ok(`Money back ₹100: "Still to come back" rolled from ${before / 100} to ${(before - 10000) / 100}, and the receipt is in the books`);

  /* ── 3. the list agrees ───────────────────────────────────────────── */
  await page.goto(`${BASE}/people`);
  const owedAfter = minor(await figureIn(page.getByRole('region', { name: 'Owed to you' })).getAttribute('aria-label'));
  assert.equal(owedAfter, owedBefore - 10000);
  ok(`/people "Owed to you" is ${owedAfter / 100}, ₹100 less`);

  /* ── 4. swipe a row open and closed ───────────────────────────────── */
  const link = page.getByRole('link', { name: new RegExp(tab.name) });
  const swipe = link.locator('xpath=..');                               // the moving layer
  const actions = swipe.locator('xpath=preceding-sibling::div[1]');      // what it covers
  const grip = swipe.getByRole('button', { name: /Show actions|Hide actions/ });
  const shut = async () => {
    await page.waitForTimeout(400);
    assert.equal(await grip.getAttribute('aria-expanded'), 'false');
    assert.equal(await actions.evaluate((el) => getComputedStyle(el).visibility), 'hidden', 'shut, the actions are not drawn');
  };
  await shut();
  /* A finger, not a mouse: touch events through the DevTools protocol, so the browser does what a phone does
     (pointerType touch, and no click after a drag). */
  const box = await link.boundingBox();
  const y = box.y + box.height / 2;
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }],
  });
  const x0 = box.x + box.width - 20;
  await touch('touchStart', x0);
  for (let i = 1; i <= 12; i++) { await touch('touchMove', x0 - i * 12); await page.waitForTimeout(16); }
  await touch('touchEnd', x0 - 144);
  await page.waitForTimeout(350);
  assert.equal(await grip.getAttribute('aria-expanded'), 'true', 'a drag to the left opens the row');
  await actions.getByRole('button', { name: 'Add cost' }).waitFor({ state: 'visible' });
  await actions.getByRole('button', { name: 'Remind' }).waitFor({ state: 'visible' });
  assert.equal(await actions.evaluate((el) => getComputedStyle(el).visibility), 'visible');
  await page.keyboard.press('Escape');
  await shut();
  ok('the tab row swipes open to Remind and Add cost, and closes on Escape with its actions no longer drawn');

  await grip.click();
  await page.waitForTimeout(350);
  assert.equal(await grip.getAttribute('aria-expanded'), 'true');
  await grip.click();
  await shut();
  ok('the grip opens and closes the same row');
} finally {
  if (!KEEP && hh && tabId) {
    await sql`delete from txn t using claim c, txn o
      where c.id = t.claim_id and o.id = c.txn_id and o.book_id = ${tabId}
        and t.household_id = ${hh} and t.kind = 'claim_receipt' and t.created_at >= ${started}`;
  }
  await browser.close();
  await sql.end();
}
console.log(`loans-taps: ${n} passed`);
