#!/usr/bin/env node
/* Activity, one screen with four chips, against a running build.

     node scripts/activity-taps.mjs [--state file] [--keep]

   Env: ACTIVITY_BASE (default http://localhost:3000), ACTIVITY_EMAIL (default ammar@example.com, the person --state is). Reads OWNER_DATABASE_URL from .env.local.
   --state is a signed-in Playwright storage state for an owner or contributing member (default .sweep-state.json).

   1. At 360px the four chips sit on one line (short words below 390px) and never scroll sideways; each is a link to ?f=…, and each lands lit.
   2. /inbox and /schedules redirect to their chips, keeping their params.
   3. A possible duplicate opens with from=/entries?f=review, and Save there lands back on To review.
   4. Upcoming: Record the first due from its swipe; the calendar's drawer shows it paid with "See the entry";
      that entry's Save lands on ?f=upcoming, and so does its Delete.
   Rows this run wrote (one entry and its occurrence) are removed unless --keep.                               */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { localOwnerUrl } from './local-only.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const postgres = require('postgres');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.ACTIVITY_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const KEEP = argv.includes('--keep');

const sql = postgres(localOwnerUrl(ROOT), { ssl: 'require', max: 1, onnotice: () => {} });
const started = (await sql`select now() as t`)[0].t;
/* Whose books: the person --state signs in as. Only their household, and only what they record during the run that
   was not there before, is this run's to clean up. */
const EMAIL = process.env.ACTIVITY_EMAIL || 'ammar@example.com';
const [me] = await sql`select id, active_household_id as hh from app_user where lower(email) = lower(${EMAIL})`;
assert.ok(me?.hh, `${EMAIL} has books`);
let occBefore = null;      // the household's occurrence ids before step 4
let madeOcc = null;        // the one step 4 recorded
const runOccurrences = () => sql`select o.id, o.schedule_id, o.due_on::text as due_on, o.txn_id
  from occurrence o join schedule s on s.id = o.schedule_id join txn t on t.id = o.txn_id
  where s.household_id = ${me.hh} and t.household_id = ${me.hh} and t.created_by = ${me.id}
    and t.created_at >= ${started} and not (o.id = any(${occBefore}::uuid[]))`;

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const strip = (d) => { const { defaultBrowserType, ...rest } = d; void defaultBrowserType; return rest; };
const IOS = { ...strip(devices['iPhone 13']), viewport: { width: 360, height: 780 }, screen: { width: 360, height: 780 } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...IOS, storageState: STATE });
const page = await ctx.newPage();

try {
  /* ── 1. chips wrap, link, light ───────────────────────────────────── */
  await page.goto(`${BASE}/entries`);
  const nav = page.getByRole('navigation', { name: 'Activity' });
  await nav.waitFor();
  const box = await nav.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth, ox: getComputedStyle(el).overflowX,
    right: Math.max(...[...el.children].map((c) => c.getBoundingClientRect().right)), vw: innerWidth,
    tops: [...new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top)))],
    words: [...el.children].map((c) => c.innerText.replace(/\s+/g, ' ').trim()) }));
  assert.ok(box.sw <= box.cw && box.ox !== 'auto' && box.ox !== 'scroll', `the chip row does not scroll: ${JSON.stringify(box)}`);
  assert.ok(box.right <= box.vw, `every chip is on screen at 360px: ${JSON.stringify(box)}`);
  /* Below 390px the two long chips show short words (Review, SMS), so the four sit on one line; their names stay whole. */
  assert.equal(box.tops.length, 1, `the four chips are on one line at 360px: ${JSON.stringify(box)}`);
  assert.ok(box.words.some((w) => /^Review\b/.test(w)) && box.words.includes('SMS'), `short words at 360px: ${JSON.stringify(box.words)}`);
  ok(`at 360px the four chips sit on one line (${box.words.join(' · ')}): nothing scrolls sideways, every chip is on screen`);
  for (const [name, f] of [['To review', 'review'], ['Upcoming', 'upcoming'], ['From SMS', 'sms'], ['All', null]]) {
    const chip = nav.getByRole('link', { name: new RegExp(`^${name}`) });
    assert.equal(await chip.getAttribute('href'), f ? `/entries?f=${f}` : '/entries');
    await chip.click();
    await page.waitForURL((u) => (f ? u.search === `?f=${f}` : u.search === '') && u.pathname === '/entries');
    await nav.getByRole('link', { name: new RegExp(`^${name}`) }).and(page.locator('[aria-current=page]')).waitFor();
  }
  ok('each chip is a link to its ?f= and lands lit');

  /* ── 2. old addresses ─────────────────────────────────────────────── */
  await page.goto(`${BASE}/inbox?x=1`);
  await page.waitForURL(/\/entries\?f=review&x=1$/);
  await page.goto(`${BASE}/schedules?m=2026-09-01`);
  await page.waitForURL(/\/entries\?f=upcoming&m=2026-09-01$/);
  ok('/inbox and /schedules redirect to their chips with their params');

  /* ── 3. a duplicate opens from To review and Save returns there ──── */
  await page.goto(`${BASE}/entries?f=review`);
  const dupLink = page.getByRole('region', { name: 'Possibly recorded twice' }).locator('a[href^="/entries/"]').first();
  if (await dupLink.count()) {
    const href = await dupLink.getAttribute('href');
    assert.match(href, /\?from=%2Fentries%3Ff%3Dreview$/);
    await dupLink.click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(/\/entries\?f=review$/, { timeout: 20000 });
    ok('a duplicate opens with from=?f=review, and its Save lands back on To review');
  } else {
    console.log('  skip no possible duplicates in these books');
  }

  /* ── 4. Upcoming: record, open from the calendar, Save and Delete return to Upcoming ── */
  await page.goto(`${BASE}/entries?f=upcoming`);
  const dueCard = page.getByRole('region', { name: 'Due in the next two weeks' });
  await dueCard.waitFor();
  // The grip's label flips to "Hide actions" once open, so it is found by what does not change.
  const firstGrip = dueCard.locator('button[aria-expanded]').first();
  const row = firstGrip.locator('xpath=ancestor::*[button[@aria-expanded]][1]/..');
  occBefore = (await sql`select o.id from occurrence o join schedule s on s.id = o.schedule_id
    where s.household_id = ${me.hh}`).map((r) => r.id);
  await firstGrip.click();
  await row.getByRole('button', { name: /^(Record|Came in)$/ }).click();
  await page.getByRole('button', { name: /^Record (the payment|that it came in)$/ }).click();
  let occ;
  for (let i = 0; i < 75 && !occ; i++) {
    [occ] = await runOccurrences();
    if (occ) madeOcc = occ;
    if (!occ) await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(occ, 'recording wrote a paid occurrence with its entry');
  ok(`Record from the due row's swipe: paid, with an entry (${occ.due_on})`);

  await page.goto(`${BASE}/entries?f=upcoming`);
  const fold = page.locator('button[aria-controls="cal-grid"]');
  if ((await fold.getAttribute('aria-expanded')) !== 'true') await fold.click();
  const [y, m, d] = occ.due_on.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const grid = page.getByRole('grid', { name: `${MONTHS[m - 1]} ${y}` });
  await grid.waitFor();
  const cell = grid.getByRole('gridcell', { name: new RegExp(`^${d} ${MONTHS[m - 1]},`) });
  // The day says what lands on it in words, not only as dots: "9 November, 28 Jumada I 1448, 1 scheduled".
  assert.match(await cell.getByRole('button').getAttribute('aria-label'), /, \d+ scheduled$/, 'a busy day carries its count');
  await cell.click();
  const see = page.getByRole('link', { name: 'See the entry' }).first();
  await see.waitFor();
  assert.equal(await see.getAttribute('href'), `/entries/${occ.txn_id}?from=%2Fentries%3Ff%3Dupcoming`);
  await see.click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForURL(/\/entries\?f=upcoming$/, { timeout: 20000 });
  ok('the calendar drawer opens the entry with from=?f=upcoming, and Save lands back on Upcoming');

  await page.goto(`${BASE}/entries/${occ.txn_id}?from=${encodeURIComponent('https://example.com/')}`);
  assert.equal(await page.getByRole('link', { name: 'Back' }).first().getAttribute('href'), '/entries');
  ok('a from that is not on the list falls back to /entries');
  await page.goto(`${BASE}/entries/${occ.txn_id}?from=${encodeURIComponent('/entries?f=upcoming')}`);
  await page.getByRole('button', { name: 'Delete this entry' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.waitForURL(/\/entries\?f=upcoming$/, { timeout: 20000 });
  assert.ok((await sql`select deleted_at from txn where id = ${occ.txn_id}`)[0].deleted_at);
  ok('Delete honours the same from: deleted, back on Upcoming');

} finally {
  await browser.close();
  if (!KEEP) {
    /* The due step 4 recorded, by id; or, if the run stopped before it was seen, what this person recorded in this
       household since the run began that was not there before. */
    const rows = madeOcc ? [madeOcc] : occBefore ? await runOccurrences() : [];
    for (const r of rows) {
      await sql`delete from occurrence where id = ${r.id}`;
      await sql`delete from txn where id = ${r.txn_id} and household_id = ${me.hh}`;
    }
    if (rows.length) console.log(`  cleaned up ${rows.length} recorded due(s)`);
  }
  await sql.end();
}
console.log(`\n  activity-taps: ${n} passed\n`);
