#!/usr/bin/env node
/* Accounts, Upcoming and Categories, the screens restyled in Task 27b, against a running build.

     node scripts/accounts-taps.mjs [--state file]

   Env: ACCOUNTS_BASE (default http://localhost:3000), ACCOUNTS_EMAIL (default ammar@example.com).
   Reads OWNER_DATABASE_URL from .env.local. --state is a signed-in Playwright storage state for an owner or
   contributing member (default .sweep-state.json).

   1. /accounts: open a bank account's row (the bank account with the most entries), raise its starting balance
      by ₹1, and its balance Figure on the row rolls to ₹1 more; put it back and the Figure returns.
   2. Reconcile that account: type a statement ₹1 above the books, record the ₹1 as an adjustment and finish;
      the "in the books today" Figure says ₹1 more. Undo (two taps) and it is back where it was.
   3. /schedules (a redirect to Upcoming): add a throwaway regular payment and see it listed, then Stop it from
      its swipe grip and see it gone.
   4. /categories: rename the top-level spending category with the most entries and see the row follow; rename it
      back.
   Everything the run made is removed, and every name and balance it touched is put back, even on a failure. */
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
const BASE = (process.env.ACCOUNTS_BASE || 'http://localhost:3000').replace(/\/$/, '');
const EMAIL = process.env.ACCOUNTS_EMAIL || 'ammar@example.com';
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const sql = postgres(/^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(env)[1], { ssl: 'require', max: 1, onnotice: () => {} });

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const strip = (d) => { const { defaultBrowserType, ...rest } = d; void defaultBrowserType; return rest; };
const IOS = { ...strip(devices['iPhone 13']), viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...IOS, storageState: STATE });
const page = await ctx.newPage();
/* A Figure is an img named by the formatted amount (whole rupees unless paise are asked for). */
const rupeesOf = (label) => Number(String(label).replace(/[^0-9.-]/g, ''));
const figureIn = (scope) => scope.getByRole('img').first();
/** Wait until the Figure inside `scope` names a different amount from `was`, and return the new label. */
async function changed(scope, was) {
  const fig = figureIn(scope);
  for (let i = 0; i < 100; i++) {
    const now = await fig.getAttribute('aria-label');
    if (now !== was) return now;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`the Figure still reads ${was}`);
}
/** The rupees as the form shows them: whole when there are no paise. */
const keys = (minor) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

const TAG = Date.now().toString(36);
const SCHEDULE = `Accounts taps ${TAG}`;
let hh = null;
let acc = null;          // { id, name, opening }
let reconBefore = [];    // reconciliation ids on the account before the run
let adjustBefore = [];   // adjustment entries on the account before the run
let cat = null;          // { id, name }

try {
  [{ hh }] = await sql`select active_household_id as hh from app_user where lower(email) = lower(${EMAIL})`;
  /* A bank account picked by what it holds, not by its name: the live spending account with the most entries. */
  [acc] = await sql`select a.id, a.name, a.opening_balance::text as opening
    from account a left join txn t on (t.account_id = a.id or t.counter_account_id = a.id) and t.deleted_at is null
    where a.household_id = ${hh} and a.kind = 'spending' and a.archived_at is null
    group by a.id order by count(t.id) desc, a.id limit 1`;
  assert.ok(acc, 'a bank account to work on');
  const balanceOf = async () => Number((await sql`select balance::text as b from account_balance where id = ${acc.id}`)[0].b);
  reconBefore = (await sql`select id from reconciliation where account_id = ${acc.id}`).map((r) => r.id);
  adjustBefore = (await sql`select id from txn where account_id = ${acc.id} and kind in ('adjust_in', 'adjust_out')`).map((r) => r.id);

  /* ── 1. edit the starting balance on /accounts ────────────────────── */
  await page.goto(`${BASE}/accounts`);
  await page.getByRole('heading', { name: 'Accounts' }).waitFor();
  const start = await balanceOf();
  const row = page.getByRole('button', { name: `Edit ${acc.name}` });
  const shown = await figureIn(row).getAttribute('aria-label');
  assert.equal(rupeesOf(shown), Math.round(start / 100), `the row shows the balance (${shown})`);
  const setOpening = async (minor) => {
    await row.click();
    const form = page.getByRole('form', { name: `Edit ${acc.name}` });
    await form.getByLabel('Balance before the first entry').fill(keys(minor));
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await form.waitFor({ state: 'detached', timeout: 20000 });
  };
  await setOpening(Number(acc.opening) + 100);
  const raised = await changed(row, shown);
  assert.equal(rupeesOf(raised), rupeesOf(shown) + 1);
  assert.equal(await balanceOf(), start + 100);
  ok(`${acc.name}: starting balance +₹1, and the row's Figure moves from ${shown} to ${raised}`);
  await setOpening(Number(acc.opening));
  assert.equal(await changed(row, raised), shown);
  assert.equal(await balanceOf(), start);
  ok(`put back, and the Figure reads ${shown} again`);

  /* ── 2. reconcile with a ₹1 adjustment, then undo ─────────────────── */
  await page.goto(`${BASE}/accounts/reconcile`);
  await page.getByRole('link', { name: new RegExp(`^${acc.name}`) }).click();
  await page.waitForURL(new RegExp(`/accounts/${acc.id}/reconcile`));
  const books = page.getByRole('region', { name: 'In the books today' });
  const before = await figureIn(books).getAttribute('aria-label');
  await page.getByLabel('Statement balance').fill(keys(Math.abs(start) + 100));
  await page.getByText('Difference', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^Record \+₹1(\.00)? as an adjustment$/ }).click();
  await page.waitForURL(/[?&]done=/, { timeout: 20000 });
  await page.getByRole('status').filter({ hasText: 'adjustment recorded' }).waitFor();
  const after = await changed(books, before);
  assert.equal(rupeesOf(after), rupeesOf(before) + 1);
  assert.equal(await balanceOf(), start + 100);
  ok(`matched to a statement ₹1 above the books: the adjustment is recorded and the Figure moves from ${before} to ${after}`);
  const matched = page.getByRole('region', { name: 'Statements matched' });
  await matched.getByRole('button', { name: 'Undo' }).click();
  await matched.getByRole('button', { name: 'Yes, undo' }).click();
  assert.equal(await changed(books, after), before);
  assert.equal(await balanceOf(), start);
  ok(`Undo takes the match and its adjustment away: ${before} again`);

  /* ── 3. a throwaway regular payment ───────────────────────────────── */
  await page.goto(`${BASE}/schedules`);
  await page.waitForURL((u) => u.pathname === '/entries' && u.searchParams.get('f') === 'upcoming');
  await page.getByRole('button', { name: 'Add a payment or income that comes round' }).click();
  const form = page.getByRole('form', { name: 'Add a regular payment' });
  await form.getByLabel('What is it').fill(SCHEDULE);
  await form.getByLabel('Amount').fill('123');
  /* A spending category picked by what it is: top-level, live, for spending, the one with the most entries. */
  const [spend] = await sql`select c.name from category c left join txn t on t.category_id = c.id and t.deleted_at is null
    where c.household_id = ${hh} and c.parent_id is null and c.archived_at is null and c.scope in ('expense', 'both')
    group by c.id order by count(t.id) desc, c.id limit 1`;
  await form.getByRole('button', { name: /Choose a category/ }).click();
  const finder = page.getByRole('dialog');
  await finder.getByLabel('Find a category').fill(spend.name);
  await finder.getByRole('button', { name: new RegExp(`^${spend.name}`) }).first().click();
  await form.getByRole('button', { name: 'Add it' }).click();
  const list = page.getByRole('region', { name: 'Every regular payment' });
  await list.getByText(SCHEDULE, { exact: true }).waitFor({ timeout: 20000 });
  ok(`"${SCHEDULE}" added under ${spend.name} and listed under Every regular payment`);
  // The row's own swipe: the parent of the layer that holds its grip (the actions sit beside that layer).
  const swipe = list.getByText(SCHEDULE, { exact: true }).locator('xpath=ancestor::*[button[@aria-expanded]][1]/..');
  /* Let the page settle after the form closes (a scroll shuts an open row), then open it from the grip. */
  await swipe.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const grip = swipe.getByRole('button', { name: /Show actions|Hide actions/ });
  await grip.click();
  await page.waitForFunction((el) => el.getAttribute('aria-expanded') === 'true', await grip.elementHandle());
  await swipe.getByRole('button', { name: 'Stop' }).click();
  await list.getByText(SCHEDULE, { exact: true }).waitFor({ state: 'detached', timeout: 20000 });
  const [{ archived }] = await sql`select archived_at is not null as archived from schedule where household_id = ${hh} and name = ${SCHEDULE}`;
  assert.equal(archived, true);
  ok('Stop from its swipe grip takes it off the list');

  /* ── 4. rename a category and put it back ─────────────────────────── */
  [cat] = await sql`select c.id, c.name from category c left join txn t on t.category_id = c.id and t.deleted_at is null
    where c.household_id = ${hh} and c.parent_id is null and c.archived_at is null and c.scope = 'expense'
    group by c.id order by count(t.id) desc, c.id limit 1`;
  await page.goto(`${BASE}/categories`);
  await page.getByRole('heading', { name: 'Categories' }).waitFor();
  const rename = async (from, to) => {
    await page.getByRole('button', { name: `Edit ${from}`, exact: true }).click();
    const f = page.getByRole('form', { name: `Edit ${from}` });
    await f.getByLabel('Name').fill(to);
    await f.getByRole('button', { name: 'Save', exact: true }).click();
    for (let i = 0; i < 100; i++) {
      const [{ name }] = await sql`select name from category where id = ${cat.id}`;
      if (name === to) break;
      await page.waitForTimeout(200);
    }
    await page.getByRole('form', { name: `Edit ${to}` }).getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: `Edit ${to}`, exact: true }).waitFor({ timeout: 20000 });
  };
  const temp = `${cat.name} ${TAG}`.slice(0, 40);
  await rename(cat.name, temp);
  ok(`"${cat.name}" renamed to "${temp}", and the row follows`);
  await rename(temp, cat.name);
  const [{ name: back }] = await sql`select name from category where id = ${cat.id}`;
  assert.equal(back, cat.name);
  ok(`renamed back to "${cat.name}"`);
} finally {
  if (hh) {
    await sql.begin(async (tx) => {
      await tx`delete from occurrence where schedule_id in (select id from schedule where household_id = ${hh} and name = ${SCHEDULE})`;
      await tx`delete from schedule where household_id = ${hh} and name = ${SCHEDULE}`;
      if (acc) {
        await tx`update account set opening_balance = ${acc.opening} where id = ${acc.id} and opening_balance <> ${acc.opening}`;
        /* A match this run made and did not undo: clear its ticks, then the row. Then the adjustment entries the
           run made (Undo only soft-deletes them), so nothing of the run is left in the ledger. */
        const extra = (await tx`select id from reconciliation where account_id = ${acc.id}`).map((r) => r.id).filter((id) => !reconBefore.includes(id));
        for (const id of extra) {
          await tx`update txn set reconciled_id = null where reconciled_id = ${id}`;
          await tx`update txn set counter_reconciled_id = null where counter_reconciled_id = ${id}`;
          await tx`delete from reconciliation where id = ${id}`;
        }
        const made = (await tx`select id from txn where account_id = ${acc.id} and kind in ('adjust_in', 'adjust_out')`).map((r) => r.id).filter((id) => !adjustBefore.includes(id));
        if (made.length) await tx`delete from txn where id = any(${made}::uuid[])`;
      }
      if (cat) await tx`update category set name = ${cat.name} where id = ${cat.id} and name <> ${cat.name}`;
    });
  }
  await browser.close();
  await sql.end();
}
console.log(`accounts-taps: ${n} passed`);
