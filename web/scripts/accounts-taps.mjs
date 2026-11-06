#!/usr/bin/env node
/* Accounts, Upcoming and Categories, the screens restyled in Task 27b, against a running build.

     node scripts/accounts-taps.mjs [--state file]

   Env: ACCOUNTS_BASE (default http://localhost:3000), ACCOUNTS_EMAIL (default ammar@example.com).
   Reads OWNER_DATABASE_URL from .env.local. --state is a signed-in Playwright storage state for an owner or
   contributing member (default .sweep-state.json).

   1. /accounts: open a bank account's row (the bank account in credit with the most entries), raise its starting
      balance by ₹1, and its balance Figure on the row rolls to ₹1 more; put it back and the Figure returns.
   2. Reconcile that account: type a statement ₹1 above the books, record the ₹1 as an adjustment and finish;
      the "in the books today" Figure says ₹1 more. Undo (two taps) and it is back where it was.
   2b. Add a credit card, refused once (statement day 31): Credit card, the name, the bank and the network are
      still chosen; corrected and sent again, the row in the database is a credit card on that bank and network.
      Then a second card from the same screen without a reload: also a credit card, owing what was typed.
   3. /schedules (a redirect to Upcoming): a throwaway regular payment, Once a year on the Hijri calendar, refused
      with no category (a refusal, not a 500), then with no amount (both choices still ticked after); with both it is saved as a yearly Hijri
      rule and listed; the form closes and a new one opens on the defaults. Then it is Stopped from its swipe grip.
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
/* --shots dir: also photographs the card carousel (three cards while this run's two exist) on an iPhone and a
   Pixel, light and dark. */
const SHOTS = arg('--shots');

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

/** A name as a regex that matches it whole, whatever characters it holds. */
const exactly = (name) => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const TAG = Date.now().toString(36);
const SCHEDULE = `Accounts taps ${TAG}`;
const CARD = `Taps card ${TAG}`;
const CARD2 = `${CARD} 2`;
let hh = null;
let acc = null;          // { id, name, opening }
let madeRecon = null;    // the reconciliation this run made, and its adjustment entry, for the cleanup
let madeAdjust = null;
let cat = null;          // { id, name }

try {
  [{ hh }] = await sql`select active_household_id as hh from app_user where lower(email) = lower(${EMAIL})`;
  /* A bank account picked by what it holds, not by its name: the live spending account in credit (so "₹1 above the
     books" is ₹1 more on the statement) with the most entries. */
  [acc] = await sql`select a.id, a.name, a.opening_balance::text as opening
    from account a join account_balance b on b.id = a.id
    left join txn t on (t.account_id = a.id or t.counter_account_id = a.id) and t.deleted_at is null
    where a.household_id = ${hh} and a.kind = 'spending' and a.archived_at is null and b.balance >= 0
    group by a.id order by count(t.id) desc, a.id limit 1`;
  assert.ok(acc, 'a bank account to work on');
  const balanceOf = async () => Number((await sql`select balance::text as b from account_balance where id = ${acc.id}`)[0].b);

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
  /* The row's name is the account's, then its last four, its status and its balance: anchored at the start, and
     followed only by " · " or a space, so "HDFC Savings" never also matches "HDFC Savings 2". */
  const esc = exactly(acc.name).source.slice(1, -1);
  await page.getByRole('link', { name: new RegExp(`^${esc}( · \\d{4})? (Matched|Never matched)`) }).click();
  await page.waitForURL(new RegExp(`/accounts/${acc.id}/reconcile`));
  const books = page.getByRole('region', { name: 'In the books today' });
  const before = await figureIn(books).getAttribute('aria-label');
  await page.getByLabel('Statement balance').fill(keys(Math.abs(start) + 100));
  await page.getByText('Difference', { exact: true }).waitFor();
  await page.getByRole('button', { name: /^Record \+₹1(\.00)? as an adjustment$/ }).click();
  await page.waitForURL(/[?&]done=/, { timeout: 20000 });
  madeRecon = new URL(page.url()).searchParams.get('done');
  [{ adjustment_txn_id: madeAdjust }] = await sql`select adjustment_txn_id from reconciliation where id = ${madeRecon}`;
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

  /* ── 2b. a card added after a refusal is still a card ─────────────── */
  /* React resets a <form action> once it settles, refusals included, which used to put the kind back to Bank
     account (and the bank and network back to nothing) while the screen still showed Credit card. */
  await page.goto(`${BASE}/accounts`);
  await page.getByRole('button', { name: 'Add an account' }).click();
  const add = page.getByRole('form', { name: 'Add an account' });
  await add.getByText('Credit card', { exact: true }).click();
  await add.getByLabel('Name').fill(CARD);
  await add.getByLabel('Last four digits').fill('4321');
  await add.getByText('HDFC Bank', { exact: true }).click();
  await add.getByText('Visa', { exact: true }).click();
  await add.getByLabel('Statement day').fill('31');
  await add.getByLabel('Bill due day').fill('12');
  await add.getByRole('button', { name: 'Add account' }).click();
  await add.getByRole('alert').waitFor({ timeout: 20000 });
  await page.waitForTimeout(300);
  assert.equal(await add.getByRole('radio', { name: /Credit card/ }).isChecked(), true, 'after a refusal Credit card is still ticked');
  assert.equal(await add.getByLabel('Name').inputValue(), CARD, 'after a refusal the name is kept');
  ok(`a card refused for its statement day keeps Credit card, the name, the bank and the network: "${(await add.getByRole('alert').locator('span.min-w-0').innerText()).trim()}"`);
  await add.getByLabel('Statement day').fill('5');
  await add.getByRole('button', { name: 'Add account' }).click();
  let card = [];
  for (let i = 0; i < 100 && !card.length; i++) {
    card = await sql`select kind, bank_key, card_network, statement_day from account where household_id = ${hh} and name = ${CARD}`;
    if (!card.length) await page.waitForTimeout(200);
  }
  assert.deepEqual({ ...card[0] }, { kind: 'credit', bank_key: 'hdfc', card_network: 'visa', statement_day: 5 });
  ok('corrected and sent again, it is saved as a credit card on HDFC and Visa, statement day 5');
  /* A second card from the same flow, without a reload. React resets a <form action> after a success too, which
     used to leave the open form showing Credit card while the DOM held Bank account, so the second add was saved
     as a bank account with "Currently owed" as a positive balance. The form closes on success now; open it again. */
  await add.waitFor({ state: 'detached', timeout: 20000 });
  await page.getByRole('button', { name: /^Add an account/ }).click();
  await add.getByText('Credit card', { exact: true }).click();
  await add.getByLabel('Name').fill(CARD2);
  await add.getByLabel('Last four digits').fill('8765');
  await add.getByText('HDFC Bank', { exact: true }).click();
  await add.getByText('Visa', { exact: true }).click();
  await add.getByLabel('Currently owed').fill('500');
  await add.getByLabel('Statement day').fill('6');
  await add.getByLabel('Bill due day').fill('14');
  await add.getByRole('button', { name: 'Add account' }).click();
  let both = [];
  for (let i = 0; i < 100 && both.length < 2; i++) {
    both = await sql`select name, kind, opening_balance::text as opening from account where household_id = ${hh} and name in (${CARD}, ${CARD2}) order by name`;
    if (both.length < 2) await page.waitForTimeout(200);
  }
  assert.deepEqual(both.map((r) => r.kind), ['credit', 'credit'], 'both cards are credit cards');
  assert.ok(Number(both[1].opening) < 0, `the second card owes ₹500 (opening ${both[1].opening}), not a positive balance`);
  ok('a second card added from the same screen without a reload is a credit card too, owing ₹500');

  /* ── 2c. the cards are a carousel whose dots are buttons ──────────── */
  await page.goto(`${BASE}/accounts`);
  const deck = page.getByRole('region', { name: 'Credit cards' }).and(page.locator('[data-slot=carousel]'));
  const dots = page.getByRole('group', { name: 'Which card' }).getByRole('button');
  const count = await dots.count();
  assert.ok(count >= 3, `a dot per card (${count})`);
  for (let i = 0; i < count; i++) assert.equal(await dots.nth(i).getAttribute('aria-label'), `Card ${i + 1} of ${count}`);
  const current = async () => {
    const c = await dots.evaluateAll((b) => b.map((x) => x.getAttribute('aria-current')));
    assert.equal(c.filter((v) => v === 'true').length, 1, 'exactly one dot is current');
    return c.indexOf('true');
  };
  assert.equal(await current(), 0, 'the first card is current');
  for (const d of [dots.first(), dots.last()]) {
    const b = await d.boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44, `a dot's tap target is 44px or more (${b.width}x${b.height})`);
  }
  const inView = async (i) => {
    const slide = deck.locator('[data-slot=carousel-item]').nth(i);
    await page.waitForFunction((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; },
      await slide.elementHandle(), { timeout: 5000 });
  };
  await dots.last().click();
  await page.waitForFunction((n) => document.querySelectorAll('[aria-label="Which card"] button')[n - 1]?.getAttribute('aria-current') === 'true', count);
  await inView(count - 1);
  assert.equal(await current(), count - 1);
  await deck.locator('[data-slot=carousel-item]').nth(count - 1).getByRole('button', { name: /^Edit / }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction((n) => document.querySelectorAll('[aria-label="Which card"] button')[n - 2]?.getAttribute('aria-current') === 'true', count);
  await inView(count - 2);
  ok(`${count} cards in a carousel: "Card N of ${count}" dots (44px targets) page it, the arrow keys page it, and aria-current follows`);
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const host = new URL(BASE).hostname;
    for (const [label, device, vp] of [['ios-393', devices['iPhone 13'], { width: 393, height: 852 }], ['android-412', devices['Pixel 7'], { width: 412, height: 915 }]]) {
      for (const theme of ['light', 'dark']) {
        const c = await browser.newContext({ ...strip(device), viewport: vp, screen: vp, storageState: STATE });
        await c.addCookies([{ name: 'ql.theme', value: theme, domain: host, path: '/' }]);
        const p = await c.newPage();
        await p.goto(`${BASE}/accounts`);
        await p.getByRole('heading', { name: 'Credit cards' }).scrollIntoViewIfNeeded();
        await p.evaluate(() => window.scrollBy(0, -60));
        await p.waitForTimeout(600);
        await p.screenshot({ path: path.join(SHOTS, `${label}-${theme}-cards.png`) });
        await p.getByRole('group', { name: 'Which card' }).getByRole('button').nth(1).click();
        await p.waitForTimeout(700);
        await p.screenshot({ path: path.join(SHOTS, `${label}-${theme}-cards-2.png`) });
        await c.close();
      }
    }
    ok(`card carousel screenshots in ${SHOTS}`);
  }

  /* ── 3. a throwaway regular payment ───────────────────────────────── */
  await page.goto(`${BASE}/schedules`);
  await page.waitForURL((u) => u.pathname === '/entries' && u.searchParams.get('f') === 'upcoming');
  await page.getByRole('button', { name: 'Add a payment or income that comes round' }).click();
  const form = page.getByRole('form', { name: 'Add a regular payment' });
  await form.getByLabel('What is it').fill(SCHEDULE);
  await form.getByLabel('Amount').fill('0');
  /* Once a year on the Hijri calendar, sent first with no category and then with no amount: refused each time.
     The reset after a refusal used to put both back to Every month and English while the switches still showed
     the choice, so the corrected Add made a monthly Gregorian rule. No category at all used to be a 500 (the
     empty id reached Postgres's uuid cast); it is refused in words now. */
  await form.getByText('Once a year', { exact: true }).click();
  await form.getByText('Hijri', { exact: true }).click();
  const failed = [];
  const onResponse = (r) => { if (r.request().method() === 'POST' && r.status() >= 500) failed.push(`${r.status()} ${r.url()}`); };
  page.on('response', onResponse);
  await form.getByRole('button', { name: 'Add it' }).click();
  await form.getByRole('alert').filter({ hasText: 'Choose a category.' }).waitFor({ timeout: 20000 });
  assert.deepEqual(failed, [], 'no category is a refusal, not a server error');
  ok('sent with no category: refused "Choose a category." (no 500)');
  /* A spending category picked by what it is: top-level, live, for spending, the one with the most entries. */
  const [spend] = await sql`select c.name from category c left join txn t on t.category_id = c.id and t.deleted_at is null
    where c.household_id = ${hh} and c.parent_id is null and c.archived_at is null and c.scope in ('expense', 'both')
    group by c.id order by count(t.id) desc, c.id limit 1`;
  await form.getByRole('button', { name: /Choose a category/ }).click();
  const finder = page.getByRole('dialog');
  await finder.getByLabel('Find a category').fill(spend.name);
  await finder.getByRole('button', { name: new RegExp(`^${exactly(spend.name).source.slice(1, -1)}( |$)`) }).first().click();
  await form.getByRole('button', { name: 'Add it' }).click();
  await form.getByRole('alert').filter({ hasText: 'Enter an amount.' }).waitFor({ timeout: 20000 });
  page.off('response', onResponse);
  assert.deepEqual(failed, []);
  await page.waitForTimeout(300);
  assert.equal(await form.getByRole('radio', { name: 'Once a year' }).isChecked(), true, 'Once a year is still ticked');
  assert.equal(await form.getByRole('radio', { name: 'Hijri' }).isChecked(), true, 'Hijri is still ticked');
  assert.equal(await form.getByLabel('What is it').inputValue(), SCHEDULE, 'the name is kept');
  ok('with a category but no amount: refused again, and the form still keeps the name, Once a year and Hijri');
  await form.getByLabel('Amount').fill('123');
  await form.getByRole('button', { name: 'Add it' }).click();
  const list = page.getByRole('region', { name: 'Every regular payment' });
  await list.getByText(SCHEDULE, { exact: true }).waitFor({ timeout: 20000 });
  const [rule] = await sql`select rrule, hijri_rule from schedule where household_id = ${hh} and name = ${SCHEDULE}`;
  assert.equal(rule.rrule, null, 'no Gregorian rule');
  assert.match(rule.hijri_rule ?? '', /^FREQ=YEARLY;/, 'a yearly Hijri rule');
  ok(`"${SCHEDULE}" added under ${spend.name} as ${rule.hijri_rule} on the Hijri calendar, and listed`);
  /* Saved, the form closes (React's post-success reset can then never leave its switches and the DOM apart), and
     a new one starts from the defaults on screen and in the DOM alike. */
  await form.waitFor({ state: 'detached', timeout: 20000 });
  await page.getByRole('button', { name: 'Add a payment or income that comes round' }).click();
  for (const [name, on] of [['Every month', true], ['Once a year', false], ['English', true], ['Hijri', false], ['Expense', true]]) {
    assert.equal(await form.getByRole('radio', { name }).isChecked(), on, `a fresh form: ${name} ${on ? 'ticked' : 'not ticked'}`);
  }
  ok('after a save the form closes, and the next one opens on Every month, English and Expense');
  /* A bounded month from below: "Ends · On a date" offers days from the first one on. Paging back stops at the first
     day's month, and in it no day before the first is offered, the first and every later day are. */
  await form.getByRole('button', { name: 'Change' }).click();
  await form.getByText('On a date', { exact: true }).click();
  await form.getByRole('button', { name: 'Another day…' }).click();
  const last = page.getByRole('dialog', { name: 'Last day' });
  await last.getByRole('grid').waitFor();
  const prevMonth = last.getByRole('button', { name: 'Previous month' });
  for (let i = 0; i < 24 && (await prevMonth.getAttribute('aria-disabled')) !== 'true'; i++) await prevMonth.click();
  assert.equal(await prevMonth.getAttribute('aria-disabled'), 'true', 'paging prevMonth stops at the first day\'s month');
  const span = await last.getByRole('grid').locator('button').evaluateAll((b) => b.map((x) =>
    [x.closest('td').dataset.day, !(x.disabled || x.getAttribute('aria-disabled') === 'true')]));
  const minIso = span.find(([, on]) => on)?.[0];
  assert.ok(minIso, 'at least one day is offered in the first month');
  /* The bound is the form's own: a regular payment starts today (NewSchedule's `iso`, the phone's date when the form
     opened), so the last day can be no earlier. Read from the phone's clock, not from the grid being tested. */
  const startIso = await page.evaluate(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  assert.equal(minIso, startIso, `the first day offered is the form's start, today (${startIso})`);
  assert.deepEqual(span.filter(([d, on]) => d < minIso && on).map(([d]) => d), [], 'no day before the first (min) is offered');
  assert.deepEqual(span.filter(([d, on]) => d >= minIso && !on).map(([d]) => d), [], 'the first day and every later one are offered');
  await page.keyboard.press('Escape');
  await last.waitFor({ state: 'hidden' });
  await form.getByRole('button', { name: 'Cancel' }).click();
  ok(`Ends on a date: the month pages back no further than ${minIso.slice(0, 7)}, and offers nothing before ${minIso}`);
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
        /* The match this run made, if a failure left it standing, and its adjustment entry: only those two rows
           (Undo soft-deletes the entry; nothing else on the account is touched). */
        if (madeRecon) {
          await tx`update txn set reconciled_id = null where reconciled_id = ${madeRecon}`;
          await tx`update txn set counter_reconciled_id = null where counter_reconciled_id = ${madeRecon}`;
          await tx`delete from reconciliation where id = ${madeRecon}`;
        }
        if (madeAdjust) await tx`delete from txn where id = ${madeAdjust} and kind in ('adjust_in', 'adjust_out')`;
      }
      const cards = await tx`select id from account where household_id = ${hh} and name in (${CARD}, ${CARD2})`;
      for (const c of cards) {
        await tx`delete from payment_method where funding_account_id = ${c.id}`;
        await tx`delete from account where id = ${c.id}`;
      }
      if (cat) await tx`update category set name = ${cat.name} where id = ${cat.id} and name <> ${cat.name}`;
    });
  }
  await browser.close();
  await sql.end();
}
console.log(`accounts-taps: ${n} passed`);
