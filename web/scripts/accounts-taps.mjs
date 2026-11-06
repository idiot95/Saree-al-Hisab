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
   Every form that closes on a success (Task 30) gives focus back to the button it replaced — or, for an invitation,
   to the message's heading — and says what happened in a polite live region (role=status): the cards, a way to
   pay, the regular payment, a throwaway category (2b, 3, 4) and the invitation (5).
   5. /household: invite a throwaway address as a Viewer. The message names that address and what a viewer can do,
      and the invite row says the same; then the form is edited (another address, Contributing member) and the
      message does not change, because its link is still the first invite's.
   6. An expense's "Owed back to you": a throwaway claim for the first person offered; focus is back on the button
      and the live region names the person. The claim is removed after.
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
const INVITEE = `taps-${TAG}@example.com`;
const METHOD = `Taps method ${TAG}`;
const NEWCAT = `Taps cat ${TAG}`;
let claimTxn = null;     // the entry step 6 put a claim on
/** What has focus, as a person hears it: its label, or its text. */
const focused = () => page.evaluate(() => {
  const a = document.activeElement;
  return (a?.getAttribute('aria-label') || a?.textContent || '').replace(/\s+/g, ' ').trim();
});
/** A form closed on a success: focus is on `where`, and a live region (role=status) says `text`. */
async function closedWell(where, text) {
  await page.getByRole('status').filter({ hasText: text }).first().waitFor({ state: 'attached', timeout: 10000 });
  for (let i = 0; i < 50 && !(await focused()).includes(where); i++) await page.waitForTimeout(100);
  const now = await focused();
  assert.ok(now.includes(where), `focus is on "${where}" (it is on "${now}")`);
}
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

  /* ── 0. one net worth, one "owed to you", on every screen that shows them ── */
  /* Wealth first: it is the one screen that refreshes rates, so Home and Accounts then value holdings at the same
     stored rates. */
  await page.goto(`${BASE}/worth`);
  const wealthHead = page.getByRole('region', { name: 'Household net worth' });
  const wealthWorth = await figureIn(wealthHead).getAttribute('aria-label');
  const wealthOwedRow = page.getByRole('region', { name: 'Accounts and what is owed to you' })
    .getByRole('link').filter({ hasText: 'Owed to you' });
  const wealthOwed = (await wealthOwedRow.locator('span.tabular-nums').textContent()).trim();
  await page.goto(`${BASE}/`);
  const homeRow = page.getByRole('link').filter({ hasText: 'Household net worth' });
  const homeWorth = await figureIn(homeRow).getAttribute('aria-label');
  const homeOwedRow = page.getByRole('link').filter({ hasText: 'Owed to you' });
  const homeOwed = (await homeOwedRow.count()) ? await figureIn(homeOwedRow.first()).getAttribute('aria-label') : null;
  await page.goto(`${BASE}/people`);
  const loansOwed = await figureIn(page.getByRole('region', { name: 'Owed to you' })).getAttribute('aria-label');
  await page.goto(`${BASE}/accounts`);
  const card = page.getByRole('link', { name: 'Net worth, open Wealth' });
  const accountsWorth = await figureIn(card).getAttribute('aria-label');
  const mini = (term) => card.locator('dl > div').filter({ has: page.locator('dt', { hasText: exactly(term) }) }).getByRole('img');
  const accountsOwed = await mini('Owed to you').getAttribute('aria-label');
  const [{ holdings }] = await sql`select coalesce(sum(value_minor), 0)::text as holdings
    from holding_value where household_id = ${hh} and archived_at is null`;
  assert.equal(accountsWorth, wealthWorth, `Accounts' net worth (${accountsWorth}) is Wealth's (${wealthWorth})`);
  assert.equal(homeWorth, wealthWorth, `Home's net worth (${homeWorth}) is Wealth's (${wealthWorth})`);
  assert.equal(accountsOwed, wealthOwed, `Accounts' "Owed to you" (${accountsOwed}) is Wealth's (${wealthOwed})`);
  assert.equal(loansOwed, wealthOwed, `Loans' "Owed to you" (${loansOwed}) is Wealth's (${wealthOwed})`);
  if (homeOwed !== null) assert.equal(homeOwed, wealthOwed, `Home's "Owed to you" (${homeOwed}) is Wealth's (${wealthOwed})`);
  ok(`net worth ${wealthWorth} on Wealth, Home and Accounts (holdings of ₹${Math.round(Number(holdings) / 100)} counted); owed to you ${wealthOwed} on Wealth, Accounts, Loans${homeOwed !== null ? ' and Home' : ''}`);

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
  await add.waitFor({ state: 'detached', timeout: 20000 });
  await closedWell('Add an account', `${CARD} added.`);
  ok(`the form closes: focus is back on "Add an account", and "${CARD} added." is said in a live region`);
  /* A second card from the same flow, without a reload. React resets a <form action> after a success too, which
     used to leave the open form showing Credit card while the DOM held Bank account, so the second add was saved
     as a bank account with "Currently owed" as a positive balance. The form closes on success now; open it again. */
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
  await add.waitFor({ state: 'detached', timeout: 20000 });
  await closedWell('Add an account', `${CARD2} added.`);
  /* A way to pay drawing on the first card: the same close, focus and live region. */
  await page.getByRole('button', { name: /^Add a way to pay/ }).click();
  const way = page.getByRole('form', { name: 'Add a way to pay' });
  await way.getByLabel('Takes money from').selectOption({ label: CARD });
  await way.getByLabel('Name', { exact: true }).fill(METHOD);
  await way.getByRole('button', { name: 'Add way to pay' }).click();
  await way.waitFor({ state: 'detached', timeout: 20000 });
  await closedWell('Add a way to pay', `${METHOD} added, drawing on ${CARD}.`);
  ok(`a way to pay added: focus is back on "Add a way to pay", and "${METHOD} added, drawing on ${CARD}." is said`);

  /* ── 2c. the cards are a carousel whose dots are buttons ──────────── */
  await page.goto(`${BASE}/accounts`);
  const deck = page.getByRole('region', { name: 'Credit cards' }).and(page.locator('[data-slot=carousel]'));
  const dots = page.getByRole('group', { name: 'Which card' }).getByRole('button');
  await dots.first().waitFor();
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
  await closedWell('Add a payment or income that comes round', `${SCHEDULE} added.`);
  ok(`saved, focus is back on the add row and "${SCHEDULE} added." is said in a live region`);
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
  await page.getByRole('button', { name: /^Add a category/ }).click();
  const newCat = page.getByRole('form', { name: 'Add a category' });
  /* Choosing an icon from "Show all" by keyboard: the icon stays where it is, keeps focus and is pressed (it used to
     move into the first row, so its button unmounted and focus fell to the page). Enter on one, Space on another. */
  await newCat.getByRole('button', { name: /^Show all \d+ icons$/ }).click();
  const box = newCat.getByRole('group', { name: 'All icons' });
  for (const [i, key] of [[9, 'Enter'], [17, 'Space']]) {
    const pick = box.getByRole('button').nth(i);
    const name = await pick.getAttribute('aria-label');
    await pick.focus();
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
    const same = await pick.evaluate((el) => el === document.activeElement && el.isConnected);
    assert.ok(same, `after ${key}, focus is still on "${name}" in the box`);
    assert.equal(await pick.getAttribute('aria-pressed'), 'true', `"${name}" is pressed`);
    assert.equal(await newCat.locator('input[name=icon]').inputValue(), name, `the form sends "${name}"`);
  }
  ok('an icon chosen from Show all by keyboard (Enter, then Space on another) keeps focus where it is and is pressed');
  /* Shut, the chosen icon (deep in the list) is still in sight and pressed, as a sixth tile ahead of Show all. */
  await newCat.getByRole('button', { name: 'Fewer icons' }).click();
  const chosen = await newCat.locator('input[name=icon]').inputValue();
  assert.equal(await newCat.getByRole('button', { name: chosen, exact: true, pressed: true }).count(), 1, `"${chosen}" shows, pressed, with the box shut`);
  /* Searching for something it does not match leaves it in sight too. */
  await newCat.getByLabel('Find an icon').fill('car');
  assert.equal(await newCat.getByRole('button', { name: chosen, exact: true, pressed: true }).count(), 1, `"${chosen}" stays in sight during a search`);
  await newCat.getByLabel('Find an icon').fill('');
  ok(`with the box shut, and during a search it does not match, the chosen "${chosen}" is still shown and pressed`);
  /* The reviewer's case: the chosen icon is not among the matches of a search with more than five, Show all is open,
     and the first icon in the box is chosen by keyboard. The split is over the matches only, so choosing one moves
     none of them: focus stays on it and it is pressed. */
  let query = null;
  for (const cand of ['ca', 'ar', 'in', 'er', 'o', 'e', 'a']) {
    if (cand.length && chosen.includes(cand)) continue;
    await newCat.getByLabel('Find an icon').fill(cand);
    if (await newCat.getByRole('button', { name: /^Show all \d+ matches$/ }).count()) { query = cand; break; }
  }
  assert.ok(query, 'a search with more than five matches that leaves the chosen icon out');
  assert.equal(await newCat.getByText('Chosen now').count(), 1, `"${chosen}" has its own slot during "${query}"`);
  await newCat.getByRole('button', { name: /^Show all \d+ matches$/ }).click();
  const firstInBox = newCat.getByRole('group', { name: 'All icons' }).getByRole('button').first();
  const firstName = await firstInBox.getAttribute('aria-label');
  await firstInBox.focus();
  const topBefore = await firstInBox.evaluate((el) => el.getBoundingClientRect().top);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  assert.ok(await firstInBox.evaluate((el) => el === document.activeElement && el.isConnected), `focus stays on "${firstName}"`);
  assert.equal(await firstInBox.getAttribute('aria-pressed'), 'true', `"${firstName}" is pressed`);
  /* Nothing moves under the finger: the slot keeps its place for this search, holding the old choice unpressed. */
  const topAfter = await firstInBox.evaluate((el) => el.getBoundingClientRect().top);
  assert.equal(topAfter, topBefore, `"${firstName}" has not moved (top ${topBefore} -> ${topAfter})`);
  assert.equal(await newCat.getByText('Chosen now').count(), 0, 'the slot no longer says the old choice is chosen now');
  assert.equal(await newCat.getByText('Chosen before').count(), 1, 'the slot keeps its place, saying "Chosen before"');
  assert.equal(await newCat.getByRole('button', { name: chosen, exact: true, pressed: false }).count(), 1, `"${chosen}" is still there, unpressed`);
  /* Changing the search (to the new choice's own name, which matches it and not the old one) drops the slot. */
  await newCat.getByLabel('Find an icon').fill(firstName);
  await page.waitForTimeout(100);
  assert.equal(await newCat.getByText(/^Chosen (now|before)$/).count(), 0, 'once the search changes, the old choice has no slot');
  assert.equal(await newCat.getByRole('button', { name: chosen, exact: true }).count(), 0, `"${chosen}" is no longer shown`);
  await newCat.getByLabel('Find an icon').fill('');
  ok(`searching "${query}" (the chosen "${chosen}" not among the matches), the first icon in Show all chosen by Enter keeps focus, is pressed and does not move; the old choice keeps its slot until the search changes`);
  await newCat.getByLabel('Name').fill(NEWCAT);
  await newCat.getByRole('button', { name: 'Add category' }).click();
  await newCat.waitFor({ state: 'detached', timeout: 20000 });
  await closedWell('Add a category', `${NEWCAT} added.`);
  ok(`a category added: focus is back on "Add a category", and "${NEWCAT} added." is said (it was never announced)`);

  /* ── 5. an invitation's message is the invite that was made ───────── */
  await page.goto(`${BASE}/household`);
  await page.getByRole('heading', { name: 'Invite' }).waitFor();
  await page.getByLabel('Email address').fill(INVITEE);
  await page.getByRole('radio', { name: /^Viewer/ }).check();
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const msg = page.locator('pre').filter({ hasText: '/join/' });
  await msg.waitFor({ timeout: 20000 });
  const first = await msg.innerText();
  assert.ok(first.includes(`(${INVITEE})`), 'the message names the address invited');
  assert.ok(first.includes('read everything but change nothing'), 'the message says what a viewer can do');
  const [made] = await sql`select email, role from invite where household_id = ${hh} and email = ${INVITEE} and status = 'open'`;
  assert.deepEqual({ ...made }, { email: INVITEE, role: 'viewer' }, 'the invite row is a viewer at that address');
  ok(`invited ${INVITEE} as a Viewer: the message and the invite row agree`);
  await closedWell('Invitation ready', `Invitation ready for ${INVITEE}.`);
  ok('focus is on the message\'s heading, "Invitation ready", and the live region says so');
  await page.getByLabel('Email address').fill(`other-${INVITEE}`);
  await page.getByRole('radio', { name: /^Contributing member/ }).check();
  await page.waitForTimeout(300);
  assert.equal(await msg.innerText(), first, 'editing the form after create leaves the message as it was');
  ok('the form edited afterwards (another address, Contributing member): the message is unchanged');
  /* A second invitation to the same address replaces the first, and is said again: the live region is emptied on
     submit and filled on success, so a screen reader hears it though the words are the same. */
  const watchSaid = (fragment) => page.evaluate((frag) => {
    const el = [...document.querySelectorAll('[role=status]')].find((x) => x.className.includes('sr-only') && x.closest('main') && (x.textContent.includes(frag) || x.dataset.watch === frag));
    el.dataset.watch = frag;
    window.__said = [el.textContent];
    new MutationObserver(() => window.__said.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  }, fragment);
  await watchSaid('Invitation ready for');
  await page.getByLabel('Email address').fill(INVITEE);
  await page.getByRole('button', { name: 'Create invitation' }).click();
  await page.waitForFunction((t) => (window.__said ?? []).slice(1).includes(t), `Invitation ready for ${INVITEE}. The message to send is below.`, { timeout: 20000 });
  const heard = await page.evaluate(() => window.__said);
  assert.ok(heard.slice(1).includes(''), `the region was emptied before it was filled again (${JSON.stringify(heard)})`);
  ok('a second invitation to the same address is announced again (the live region empties, then says it)');

  /* The household's name saved twice, unchanged: "Household name saved." is said each time, from a live region outside
     the redrawn form. Nothing in the books changes. */
  await page.getByRole('button', { name: /^Rename this household/ }).click();
  const hhName = await page.getByLabel('Household name').inputValue();
  const saveName = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForFunction(() => (window.__said ?? []).at(-1) === 'Household name saved.', null, { timeout: 20000 });
  };
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('main [role=status].sr-only')].find((x) => !x.textContent.includes('Invitation'));
    window.__said = [el.textContent];
    new MutationObserver(() => window.__said.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await saveName();
  await saveName();
  const names = await page.evaluate(() => window.__said);
  assert.equal(names.filter((t) => t === 'Household name saved.').length, 2, `said twice (${JSON.stringify(names)})`);
  assert.equal(await page.getByLabel('Household name').inputValue(), hhName, 'the name is as it was');
  await page.getByRole('button', { name: 'Cancel' }).first().click();
  ok(`the household's name saved twice unchanged: "Household name saved." is said each time`);

  /* ── 6. someone owes me for this ──────────────────────────────────── */
  [claimTxn] = await sql`select t.id from txn t where t.household_id = ${hh} and t.kind = 'expense' and t.deleted_at is null
    and t.book_id is null and not exists (select 1 from claim c where c.txn_id = t.id) order by t.occurred_on desc, t.id limit 1`;
  assert.ok(claimTxn, 'an expense with nobody owing for it');
  await page.goto(`${BASE}/entries/${claimTxn.id}`);
  await page.getByRole('button', { name: 'Someone owes me for this' }).click();
  const owed = page.getByRole('form', { name: 'Someone owes me for this' });
  const who = (await owed.getByLabel('Who owes you').locator('option:checked').innerText()).trim();
  await owed.getByRole('button', { name: 'Someone owes me', exact: true }).click();
  await owed.waitFor({ state: 'detached', timeout: 20000 });
  await closedWell('Add someone else', `${who} owes you for this.`);
  ok(`a claim on an expense: focus is back on "Add someone else", and "${who} owes you for this." is said`);
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
      await tx`delete from invite where household_id = ${hh} and email in (${INVITEE}, ${`other-${INVITEE}`})`;
      await tx`delete from category where household_id = ${hh} and name = ${NEWCAT}`;
      if (claimTxn) await tx`delete from claim where txn_id = ${claimTxn.id} and created_at >= now() - interval '1 hour'`;
    });
  }
  await browser.close();
  await sql.end();
}
console.log(`accounts-taps: ${n} passed`);
