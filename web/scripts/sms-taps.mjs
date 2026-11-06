#!/usr/bin/env node
/* SMS capture end to end, against a running build: the setup screen, the endpoint, To review, Add entry.

     node scripts/sms-taps.mjs [--state file] [--shots dir] [--keep]

   Env: SMS_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local to check what landed.
   --state is a signed-in Playwright storage state (default .sweep-state.json) for an owner or contributing member.

   1. Household → SMS capture: Add a phone, and read the key it shows once.
   2. POST an HDFC debit (and a second message) to /api/capture/sms with it: 202.
   3. Activity › From SMS shows it: the amount, Money out, the merchant, and the account its last four name.
   4. Review opens Add entry prefilled (amount, expense, the account, "From a bank message"); pick a tile, Save.
   5. One entry with client_ref = the draft's id on that account; the draft accepted, its text null, off the list.
   6. The second draft is dismissed from its swipe; Undo brings it back; dismissed from its own screen, and
      From SMS offers that Undo too. Then it is saved as income on the matched account itself (no rail).
   7. Revoke the phone (two taps); the same POST now answers 401.
   With --shots: To review, a message, Add prefilled and the setup screen (key shown, both guides) at iPhone
   393x852 and Pixel 412x915, light and dark. Rows this run wrote are removed unless --keep.                   */
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
const BASE = (process.env.SMS_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const SHOTS = arg('--shots');
const KEEP = argv.includes('--keep');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const sql = postgres(/^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(env)[1], { ssl: 'require', max: 1, onnotice: () => {} });

const started = (await sql`select now() as t`)[0].t;
const stamp = Date.now().toString(36);

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };

const strip = (d) => { const { defaultBrowserType, ...rest } = d; void defaultBrowserType; return rest; };
const IOS = { ...strip(devices['iPhone 14 Pro']), viewport: { width: 393, height: 852 }, screen: { width: 393, height: 852 } };
const PIXEL = { ...strip(devices['Pixel 7']), viewport: { width: 412, height: 915 }, screen: { width: 412, height: 915 } };
const browser = await chromium.launch();

async function context(device, theme = 'light') {
  const ctx = await browser.newContext({ ...device, storageState: STATE, colorScheme: theme });
  await ctx.addCookies([{ name: 'ql.theme', value: theme, domain: new URL(BASE).hostname, path: '/' }]);
  return { ctx, page: await ctx.newPage() };
}
const settle = (page) => page.waitForLoadState('networkidle').catch(() => {});

const post = (token, body) => fetch(`${BASE}/api/capture/sms`, {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Add a phone on the setup screen and return the key it shows. */
async function addPhone(page, label) {
  await page.goto(`${BASE}/household/capture`);
  await page.getByLabel('Which phone is this?').fill(label);
  await page.getByRole('button', { name: /Add a phone/ }).click();
  const key = page.getByRole('region', { name: `Key for ${label}` }).locator('code').first();
  await key.waitFor({ timeout: 15000 });
  return (await key.innerText()).trim();
}

const [hdfc] = await sql`select id, household_id from real_account where name = 'HDFC Savings' and last4 = '4471' and archived_at is null`;
assert.ok(hdfc, 'the seeded books have HDFC Savings ending 4471');
const HH = hdfc.household_id;
const DEBIT = `Sent Rs.450.00 From HDFC Bank A/c XX4471 To ZOMATO On 06/11/26 Ref 61${stamp}. Not you? Call 18002586161`;
const CREDIT = `Rs.1,200.00 credited to HDFC Bank A/c XX4471 on 05-11-26 by VPA ravi@okaxis (UPI Ref No 51${stamp}).`;

let token;
try {
  /* ── 1. a key, shown once ─────────────────────────────────────────── */
  const { ctx, page } = await context(IOS);
  token = await addPhone(page, `E2E phone ${stamp}`);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  ok('Add a phone shows a 43-character key once');
  await page.getByText('Anyone with this can add drafts to your books. It won’t be shown again.').waitFor();
  const shownUrl = (await page.getByRole('region', { name: /^Key for/ }).locator('code').nth(1).innerText()).trim();
  assert.equal(shownUrl, `${BASE}/api/capture/sms`);
  ok(`with the warning and the absolute address (${shownUrl})`);
  await page.reload();
  assert.equal(await page.getByText(token).count(), 0);
  ok('and never again after a reload');

  /* ── 2. the endpoint ──────────────────────────────────────────────── */
  assert.equal((await post(token, { text: DEBIT, sender: 'AD-HDFCBK', received_at: new Date().toISOString() })).status, 202);
  assert.equal((await post(token, { text: CREDIT, sender: 'AD-HDFCBK' })).status, 202);
  ok('two bank messages POSTed with the key: 202 each');
  const drafts = await sql`select id, status, body, parsed from sms_draft where household_id = ${HH} and created_at >= ${started} order by created_at`;
  assert.equal(drafts.length, 2);
  const [debit, credit] = drafts;
  assert.equal(debit.parsed.amountMinor, 45000);
  assert.equal(debit.parsed.direction, 'debit');
  assert.equal(debit.parsed.last4, '4471');
  ok('both are open drafts; the debit read as ₹450, money out, ending 4471');

  /* ── 3. To review → From SMS ──────────────────────────────────────── */
  await page.goto(`${BASE}/entries?f=sms`);
  const section = page.getByRole('region', { name: 'From SMS' });
  await section.waitFor();
  const row = section.locator(`a[href="/inbox/sms/${debit.id}"]`);
  const text = (await row.evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll('[role=img][aria-label]').forEach((f) => f.replaceWith(f.getAttribute('aria-label')));
    return c.textContent.replace(/\s+/g, ' ');
  }));
  for (const want of ['₹450', 'Money out', 'HDFC Savings', 'from AD-HDFCBK']) assert.ok(text.includes(want), `row says ${want}: ${text}`);
  assert.match(text, /zomato/i);
  ok(`From SMS lists it: "${text.trim()}"`);
  const chip = page.getByRole('navigation', { name: 'Activity' }).getByRole('link', { name: /From SMS/ });
  assert.match(await chip.innerText(), /\d/);
  assert.equal(await chip.getAttribute('aria-current'), 'page');
  ok('on Activity › From SMS, whose chip carries a count');

  /* ── 4. Review → Add entry, prefilled → Save ──────────────────────── */
  await section.locator(`a[href="/add?draft=${debit.id}"]`).click();
  const amount = page.getByLabel(/^Amount in/).first();
  await amount.waitFor({ timeout: 15000 });
  await page.waitForFunction(() => /450/.test(document.querySelector('input[aria-label^="Amount in"]')?.value ?? ''));
  ok(`the amount is prefilled (${await amount.inputValue()})`);
  await page.getByText(/From a bank message · AD-HDFCBK/).first().waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Expense', selected: true }).count() > 0, true);
  ok('as an expense, marked "From a bank message"');
  await page.getByText('HDFC Savings').first().waitFor();
  ok('paid with HDFC Savings, the account ending 4471');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'ios-393-light-3-add-prefilled.png') });
  await page.locator('[data-category-tile]').first().click();
  const save = page.locator('[data-save]').first();
  await save.dblclick();   // a double tap: still one entry
  await page.waitForURL(/\/\?saved=/, { timeout: 20000 });
  ok('picked a tile, double-tapped Save, landed home with "saved"');

  /* ── 5. what landed ───────────────────────────────────────────────── */
  const entries = await sql`select id, amount::bigint as amount, account_id, merchant, kind from txn where household_id = ${HH} and client_ref = ${debit.id}`;
  assert.equal(entries.length, 1);
  assert.equal(Number(entries[0].amount), 45000);
  assert.equal(entries[0].account_id, hdfc.id);
  assert.equal(entries[0].kind, 'expense');
  ok(`one entry: ₹450 expense on HDFC Savings, client_ref = the draft (${entries[0].merchant})`);
  const [after] = await sql`select status, body, txn_id from sms_draft where id = ${debit.id}`;
  assert.equal(after.status, 'accepted');
  assert.equal(after.txn_id, entries[0].id);
  assert.equal(after.body, null);
  ok('the draft is accepted, points at the entry, and its text is null');
  await page.goto(`${BASE}/entries?f=sms`);
  await page.getByRole('region', { name: 'From SMS' }).waitFor();
  assert.equal(await page.locator(`a[href="/inbox/sms/${debit.id}"]`).count(), 0);
  ok('and it is gone from From SMS');

  /* ── 6. dismiss, undo, dismiss ────────────────────────────────────── */
  const crow = page.getByRole('region', { name: 'From SMS' }).locator(`a[href="/inbox/sms/${credit.id}"]`);
  // The row's own swipe: the parent of the layer that holds its grip (the actions sit beside that layer).
  const swipe = crow.locator('xpath=ancestor::*[button[@aria-expanded]][1]/..');
  await swipe.getByRole('button', { name: 'Show actions' }).click();
  await swipe.getByRole('button', { name: 'Dismiss' }).click();
  await page.getByText(/dismissed$/).waitFor();
  for (let i = 0; i < 50 && (await sql`select status from sms_draft where id = ${credit.id}`)[0].status !== 'dismissed'; i++) await new Promise((r) => setTimeout(r, 200));
  const [dis] = await sql`select status, body from sms_draft where id = ${credit.id}`;
  assert.equal(dis.status, 'dismissed');
  assert.equal(dis.body, null);
  ok('Dismiss from the swipe: dismissed, text deleted');
  await page.getByRole('button', { name: 'Undo' }).click();
  for (let i = 0; i < 50 && (await sql`select status from sms_draft where id = ${credit.id}`)[0].status !== 'open'; i++) await new Promise((r) => setTimeout(r, 200));
  assert.equal((await sql`select status from sms_draft where id = ${credit.id}`)[0].status, 'open');
  await crow.waitFor();
  ok('Undo puts it back on the list');

  if (SHOTS) {
    for (const [name, dev] of [['ios-393', IOS], ['android-412', PIXEL]]) {
      for (const theme of ['light', 'dark']) {
        const c = await context(dev, theme);
        const p = c.page;
        const at = (s) => path.join(SHOTS, `${name}-${theme}-${s}.png`);
        await p.goto(`${BASE}/entries?f=sms`); await settle(p);
        await p.screenshot({ path: at('1-to-review') });
        await p.goto(`${BASE}/inbox/sms/${credit.id}`); await settle(p);
        await p.screenshot({ path: at('2-message'), fullPage: true });
        if (!(name === 'ios-393' && theme === 'light')) {
          await p.goto(`${BASE}/add?draft=${credit.id}`); await settle(p);
          await p.getByLabel(/^Amount in/).first().waitFor();
          await p.waitForTimeout(300);
          await p.screenshot({ path: at('3-add-prefilled') });
        }
        await addPhone(p, `Shot ${name} ${theme}`);
        await settle(p);
        await p.screenshot({ path: at('4-setup-key'), fullPage: true });
        await p.getByRole('tab', { name: 'Android' }).click();
        await p.getByRole('tabpanel').waitFor();
        await p.getByRole('tabpanel').scrollIntoViewIfNeeded();
        await p.screenshot({ path: at('5-guide-android'), fullPage: true });
        await c.ctx.close();
      }
    }
    ok('screenshots taken');
  }

  await page.goto(`${BASE}/inbox/sms/${credit.id}`);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await page.waitForURL(/\/entries\?f=sms&dismissed=/, { timeout: 15000 });
  assert.equal((await sql`select status from sms_draft where id = ${credit.id}`)[0].status, 'dismissed');
  ok('dismissed again from the message screen, back to Activity › From SMS');
  await page.getByRole('button', { name: 'Undo' }).click();
  for (let i = 0; i < 50 && (await sql`select status from sms_draft where id = ${credit.id}`)[0].status !== 'open'; i++) await new Promise((r) => setTimeout(r, 200));
  assert.equal((await sql`select status from sms_draft where id = ${credit.id}`)[0].status, 'open');
  await page.waitForURL(/\/entries\?f=sms$/, { timeout: 15000 });
  ok('and From SMS offers its Undo, which reopens it');

  /* ── 6b. money in lands on the account itself ─────────────────────── */
  await page.goto(`${BASE}/add?draft=${credit.id}`);
  await page.getByLabel(/^Amount in/).first().waitFor();
  assert.equal(await page.getByRole('tab', { name: 'Income', selected: true }).count() > 0, true);
  await page.getByText('Came into').first().waitFor();
  const into = await page.getByText('Came into').first().locator('xpath=..').innerText();
  assert.match(into, /HDFC Savings/);
  assert.doesNotMatch(into, /·/);
  ok(`the credit opens as income, ${into.replace(/\s+/g, ' ').trim()}`);
  // The message's figure corrected before saving: the draft is still the one this entry came from.
  const field = page.getByLabel(/^Amount in/).first();
  await field.fill('');
  await field.fill('1250');
  await field.blur();
  await page.locator('[data-category-tile]').first().click();
  await page.locator('[data-save]').first().click();
  await page.waitForURL(/\/\?saved=/, { timeout: 20000 });
  const [inc] = await sql`select kind, amount::bigint as amount, account_id, payment_method_id from txn
                          where household_id = ${HH} and client_ref = ${credit.id}`;
  assert.equal(inc?.kind, 'income');
  assert.equal(Number(inc.amount), 125000);
  assert.equal(inc.account_id, hdfc.id);
  assert.equal(inc.payment_method_id, null);
  assert.equal((await sql`select status from sms_draft where id = ${credit.id}`)[0].status, 'accepted');
  ok('amount corrected to ₹1,250 and saved as income on HDFC Savings itself, no rail (payment_method_id null)');
  assert.equal((await sql`select status from sms_draft where id = ${credit.id}`)[0].status, 'accepted');
  await page.goto(`${BASE}/inbox`);
  await page.waitForURL(/\/entries\?f=review$/, { timeout: 15000 });
  ok('the old /inbox address lands on Activity › To review');
  await page.goto(`${BASE}/entries?f=sms`);
  await page.locator('main').first().waitFor();
  assert.equal(await page.locator(`a[href="/inbox/sms/${credit.id}"]`).count(), 0);
  ok('the edited amount still accepts the draft, and it is gone from the list');

  /* ── 7. revoke ────────────────────────────────────────────────────── */
  await page.goto(`${BASE}/household/capture`);
  const mine = page.locator('div', { has: page.getByText(`E2E phone ${stamp}`, { exact: true }) }).last();
  await mine.getByRole('button', { name: 'Revoke' }).click();
  await mine.getByRole('button', { name: 'Tap to revoke' }).click();
  await page.getByText(`E2E phone ${stamp}`, { exact: true }).waitFor({ state: 'detached', timeout: 15000 });
  ok('Revoke, then Tap to revoke: the phone is off the list');
  assert.equal((await post(token, { text: `${DEBIT} again`, sender: 'AD-HDFCBK' })).status, 401);
  ok('a POST with the revoked key: 401');
  await ctx.close();
} finally {
  await browser.close();
  if (!KEEP) {
    const ids = (await sql`select id, txn_id from sms_draft where household_id = ${HH} and created_at >= ${started}`);
    const txns = ids.map((r) => r.txn_id).filter(Boolean);
    await sql`delete from sms_draft where household_id = ${HH} and created_at >= ${started}`;
    if (txns.length) await sql`delete from txn where id in ${sql(txns)}`;
    await sql`delete from capture_token where household_id = ${HH} and created_at >= ${started}`;
    await sql`delete from rate_limit where bucket like 'capture:%'`.catch(() => {});
  }
  await sql.end();
}
console.log(`\n  ${n} passed\n`);
