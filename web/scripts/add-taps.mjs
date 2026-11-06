#!/usr/bin/env node
/* Add Entry, driven the way a thumb drives it, against a running build.

     node scripts/add-taps.mjs [--login email:password | --state file] [--shots dir] [--keep]

   Env: ADD_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local to check what landed.

   1. The common case is three taps. From Home, open the drawer; then type 2340, tap the first tile, tap Save —
      exactly three interactions after the drawer opens (the field is focused on open, so typing needs no tap).
      A new txn row, and "Entry saved".
   2. Income that clears a claim: the amount equals an open claim, More opens by itself, the exact-match offer is
      one tap, Save needs no category, and claim_receipt rows land for it.
   3. A Move between two accounts: From is already answered, To is one drawer; a transfer row lands.
   4. An expense on a tab, "No, I covered it": the entry is on the tab, counts_as_spend is false, claims exist.
   5. Offline: the save is kept on the phone, and on reconnecting drains into exactly one row with its client_ref.
   6. An entry in the OLD wizard's shape, put straight into ql.queue.v1, drains into exactly one row.

   Rows this run wrote are removed at the end unless --keep.                                                   */
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
const BASE = (process.env.ADD_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const LOGIN = arg('--login') ?? 'ammar@example.com:Correct-horse-9';
const SHOTS = arg('--shots');
const KEEP = argv.includes('--keep');

const env = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const url = /^OWNER_DATABASE_URL="?([^"\n]+)/m.exec(env)[1];
const sql = postgres(url, { ssl: 'require', max: 1, onnotice: () => {} });

const email = LOGIN.slice(0, LOGIN.indexOf(':')), password = LOGIN.slice(LOGIN.indexOf(':') + 1);
const [user] = await sql`select id, active_household_id as hh from app_user where email = ${email}`;
assert.ok(user?.hh, `${email} has no books`);
const HH = user.hh;
const started = (await sql`select now() as t`)[0].t;
const wrote = new Set();

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };

const browser = await chromium.launch();
const ios = (() => { const { defaultBrowserType, ...d } = devices['iPhone 13']; return d; })(); // eslint-disable-line @typescript-eslint/no-unused-vars
const pixel = (() => { const { defaultBrowserType, ...d } = devices['Pixel 7']; return d; })(); // eslint-disable-line @typescript-eslint/no-unused-vars

/* Signed in once (sign-in is rate limited), then every context starts from that session. */
/* --state <file> reuses a signed-in Playwright state (the sweep's .sweep-state.json) instead of signing in. */
const GIVEN = arg('--state');
const STATE = GIVEN ?? path.join(ROOT, '.add-taps-state.json');
if (!GIVEN) {
  const ctx = await browser.newContext({ ...ios });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/signin`);
  await page.getByText('Sign in with your password').click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 20000 });
  await ctx.storageState({ path: STATE });
  await ctx.close();
}

async function context(device, theme = 'light', viewport) {
  const ctx = await browser.newContext({ ...device, storageState: STATE, ...(viewport ? { viewport, screen: viewport } : {}) });
  await ctx.addCookies([{ name: 'ql.theme', value: theme, domain: new URL(BASE).hostname, path: '/' }]);
  const page = await ctx.newPage();
  return { ctx, page };
}

/** Home, then the Add tab: the drawer over Home, the amount field focused. */
async function openDrawer(page) {
  await page.goto(`${BASE}/`);
  await page.locator('a[href="/add"]').first().click();
  const drawer = page.locator('[data-slot=drawer-content]');
  await drawer.waitFor();
  const amount = drawer.getByLabel(/^Amount in/);
  await amount.waitFor();
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Amount in'));
  return drawer;
}

const newRows = (extra = sql``) => sql`
  select id, kind, amount::bigint as amount, occurred_on::text as occurred_on, category_id, counter_account_id, book_id, counts_as_spend, claim_id, client_ref
  from txn where household_id = ${HH} and created_by = ${user.id} and created_at >= ${started} ${extra}
  order by created_at`;
async function waitRows(pred, what, ms = 15000) {
  const until = Date.now() + ms;
  for (;;) {
    const rows = (await newRows()).filter((r) => !wrote.has(r.id));
    const hit = rows.filter(pred);
    if (hit.length) { hit.forEach((r) => wrote.add(r.id)); return hit; }
    if (Date.now() > until) throw new Error(`no row for: ${what}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}
/** What a button says, with each rolling Figure read from its label (its digits live in a shadow root). */
const said = (loc) => loc.evaluate((el) => {
  const c = el.cloneNode(true);
  c.querySelectorAll('[role=img][aria-label]').forEach((f) => f.replaceWith(f.getAttribute('aria-label')));
  c.querySelectorAll('[aria-hidden=true]').forEach((f) => { if (!f.textContent.trim().match(/^·$/)) f.remove(); });
  return c.textContent.replace(/\s+/g, ' ').trim();
});
/** A drawer's shape: every drawer has a Close button and is capped at 86% of the screen (Task 30: the Add drawer and
 *  the pickers used to stop at 80vh, and only the newer drawers had a Close). */
async function drawerHasCloseAndCap(page, drawer, what) {
  await drawer.getByRole('button', { name: 'Close', exact: true }).first().waitFor();
  const { cap, vh } = await drawer.evaluate((el) => ({ cap: parseFloat(getComputedStyle(el).maxHeight), vh: innerHeight }));
  assert.ok(Math.abs(cap - vh * 0.86) <= 1, `${what}: capped at 86dvh (${cap}px of ${vh}px)`);
}
const keysFor = (minor) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

try {
  /* ── 1. three taps ───────────────────────────────────────────────────── */
  {
    const { ctx, page } = await context(ios);
    const drawer = await openDrawer(page);
    await drawerHasCloseAndCap(page, drawer, 'the Add drawer');
    let taps = 0;
    await page.keyboard.type('2340'); taps++;                       // 1: the amount
    const tile = drawer.locator('[data-category-tile]').first();
    const name = (await tile.locator('span').last().innerText()).trim();
    await tile.click(); taps++;                                      // 2: the first tile
    const save = drawer.locator('[data-save]');
    await assert.doesNotReject(save.waitFor());
    const label = await said(save);
    assert.equal(label, `Save · ₹2,340 ${name}`);
    ok(`Save reads "${label}"`);
    await save.click(); taps++;                                      // 3: Save
    assert.equal(taps, 3);
    await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
    ok('three interactions after the drawer opens, then "Entry saved." (the drawer has a Close button and an 86dvh cap)');
    const [row] = await waitRows((r) => r.kind === 'expense' && Number(r.amount) === 234000, '2340 expense');
    assert.ok(row.category_id);
    ok('one new expense row of ₹2,340 with its category');
    const [{ last_paid_with: lp }] = await sql`select last_paid_with from app_user where id = ${user.id}`;
    assert.match(lp ?? '', /^[am]:/);
    ok(`last_paid_with remembered (${lp.slice(0, 2)}…)`);
    /* Edit on the saved snack is one navigation, a push to the entry: closing the snack no longer also replaces the
       address (that replace's Back mark could be spent by the push). Back from the entry says nothing again and
       only takes ?saved= off, and the trail ends where the history does: at Home. */
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/entries/${row.id}`, { timeout: 15000 });
    await page.getByRole('link', { name: 'Back' }).first().click();
    await page.waitForURL((u) => u.pathname === '/' && !u.searchParams.has('saved'), { timeout: 15000 });
    await page.waitForTimeout(800);
    assert.equal(await page.getByText('Entry saved.').count(), 0, 'no second "Entry saved." on the way back');
    const trailNow = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ql.trail.v1') ?? '[]'));
    assert.equal(trailNow.at(-1), '/', `the trail ends at Home (${JSON.stringify(trailNow)})`);
    assert.ok(!trailNow.some((u) => u.startsWith('/?saved=')), `and holds no ?saved= step (${JSON.stringify(trailNow)})`);
    ok('Edit on the saved snack opens the entry; Back returns to a clean Home, the trail in step');
    await ctx.close();
  }

  /* ── 2. income that clears a claim ───────────────────────────────────── */
  {
    const claims = await sql`
      select cs.id, cs.outstanding::bigint as o from claim_state cs join txn t on t.id = cs.txn_id and t.deleted_at is null
      where cs.household_id = ${HH} and cs.status in ('open','part_paid') and cs.outstanding > 0 order by t.occurred_on`;
    if (!claims.length) console.log('  skip income: no open claim in these books');
    else {
      const target = Number(claims[0].o);
      const same = claims.filter((c) => Number(c.o) === target).map((c) => c.id);
      const { ctx, page } = await context(ios);
      await page.goto(`${BASE}/add`);
      await page.getByRole('tab', { name: 'Income' }).click();
      await page.getByLabel(/^Amount in/).fill(keysFor(target));
      const offer = page.locator('[data-exact-offer]');
      await offer.waitFor({ timeout: 5000 });
      ok('More opens by itself on an exact match, and offers it');
      await offer.click();
      const save = page.locator('[data-save]');
      assert.ok(await save.isEnabled());
      assert.match(await said(save), /money back$/);
      ok('Save needs no category when all of it is money back');
      await save.click();
      await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
      const rows = await waitRows((r) => r.kind === 'claim_receipt' && same.includes(r.claim_id), 'claim receipt');
      assert.equal(rows.reduce((s, r) => s + Number(r.amount), 0), target);
      const income = (await newRows()).filter((r) => r.kind === 'income' && !wrote.has(r.id));
      assert.equal(income.length, 0);
      ok(`a claim_receipt of ${target} clears the claim; no income row`);
      await ctx.close();
    }
  }

  /* ── 3. a Move ───────────────────────────────────────────────────────── */
  {
    const { ctx, page } = await context(pixel);
    await page.goto(`${BASE}/add`);
    await page.getByRole('tab', { name: 'Move' }).click();
    await page.getByLabel(/^Amount in/).fill('1000');
    const save = page.locator('[data-save]');
    assert.ok(await save.isDisabled());
    ok('Move: Save waits for To');
    const toRow = page.getByRole('button', { name: /^To/ });
    await toRow.click();
    const toDrawer = page.getByRole('dialog', { name: 'To which account' });
    await drawerHasCloseAndCap(page, toDrawer, 'the To drawer');
    await toDrawer.getByRole('button', { name: 'Close', exact: true }).click();
    await toDrawer.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Choose an account'));
    ok('the To picker has a Close button and an 86dvh cap; Close puts focus back on the To row');
    await toRow.click();
    const to = page.getByRole('radiogroup', { name: 'To which account' }).getByRole('radio').first();
    await to.click();
    assert.ok(await save.isEnabled());
    assert.match(await said(save), /^Save · ₹1,000 to /);
    await save.click();
    await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
    const [row] = await waitRows((r) => r.kind === 'transfer' && Number(r.amount) === 100000, 'transfer');
    assert.ok(row.counter_account_id && !row.category_id);
    ok('a transfer lands between two accounts, with no category');
    await ctx.close();
  }

  /* ── 4. an expense on a tab, "No, I covered it" ──────────────────────── */
  {
    const [tab] = await sql`select id, name from ledger_book where household_id = ${HH} and closed_at is null limit 1`;
    if (!tab) console.log('  skip tab: no open tab');
    else {
      const { ctx, page } = await context(ios);
      await page.goto(`${BASE}/add`);
      await page.getByLabel(/^Amount in/).fill('612');
      await page.locator('[data-category-tile]').first().click();
      await page.getByRole('button', { name: /Note, bill, tab/ }).click();
      await page.getByRole('group', { name: 'Which tab' }).getByRole('button', { name: tab.name }).click();
      await page.getByRole('button', { name: /No, I covered it/ }).click();
      await page.locator('[data-save]').click();
      await page.waitForURL(new RegExp(`/tab/${tab.id}`), { timeout: 15000 });
      const [row] = await waitRows((r) => r.kind === 'expense' && Number(r.amount) === 61200, 'tab expense');
      assert.equal(row.book_id, tab.id);
      assert.equal(row.counts_as_spend, false);
      const claims = await sql`select count(*)::int as n, sum(expected_amount)::bigint as s from claim where txn_id = ${row.id}`;
      assert.ok(claims[0].n >= 1 && Number(claims[0].s) === 61200);
      ok(`on the tab, not counted as spending, claims for all ₹612 (${claims[0].n})`);
      await ctx.close();
    }
  }

  /* ── 5. offline, then back ───────────────────────────────────────────── */
  {
    const { ctx, page } = await context(ios);
    const drawer = await openDrawer(page);
    await ctx.setOffline(true);
    await page.keyboard.type('777');
    await drawer.locator('[data-category-tile]').first().click();
    await drawer.locator('[data-save]').click();
    await drawer.getByText(/kept on this phone/).waitFor();
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]'));
    assert.equal(queued.length, 1);
    const ref = queued[0].clientRef;
    ok('offline: kept on this phone, one entry queued with a clientRef');
    await ctx.setOffline(false);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]').length === 0, null, { timeout: 20000 });
    const rows = await sql`select id from txn where household_id = ${HH} and client_ref = ${ref}`;
    assert.equal(rows.length, 1);
    rows.forEach((r) => wrote.add(r.id));
    ok('back online: the queue drains into exactly one row carrying its client_ref');
    await ctx.close();
  }

  /* ── 6. an entry queued by the old wizard ────────────────────────────── */
  {
    const [cat] = await sql`select id from category where household_id = ${HH} and archived_at is null
      and scope in ('expense','both') order by sort_order limit 1`;
    const [rail] = await sql`select pm.id from payment_method pm where pm.household_id = ${HH} and pm.archived_at is null limit 1`;
    const ref = crypto.randomUUID();
    const old = {
      kind: 'expense', amountMinor: 4321, categoryId: cat.id, paidWith: `m:${rail.id}`, counterAccountId: null,
      merchant: 'Old wizard', note: '', occurredOn: new Date().toISOString().slice(0, 10), isShared: true,
      attachments: null, tabId: null, tabCoveredMinor: null, countsAsSpend: null, settles: [],
      householdId: HH, clientRef: ref, queuedAt: new Date().toISOString(),
    };
    const { ctx, page } = await context(ios);
    await page.goto(`${BASE}/entries`);
    await page.evaluate((q) => { localStorage.setItem('ql.queue.v1', JSON.stringify([q])); dispatchEvent(new Event('online')); }, old);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]').length === 0, null, { timeout: 20000 });
    const rows = await sql`select id, merchant from txn where household_id = ${HH} and client_ref = ${ref}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].merchant, 'Old wizard');
    rows.forEach((r) => wrote.add(r.id));
    ok('an entry in the old wizard\'s shape drains through saveEntry into exactly one row');
    await ctx.close();
  }

  /* ── 7. All opens the finder, over the drawer ───────────────────────── */
  {
    const { ctx, page } = await context(ios);
    const drawer = await openDrawer(page);
    await page.keyboard.type('50');
    const seats = await drawer.locator('[data-category-tile] span:last-child').allInnerTexts();
    await drawer.getByRole('button', { name: 'All categories' }).click();
    const find = page.getByRole('searchbox', { name: 'Find a category' });
    await find.waitFor();
    const all = await page.getByRole('dialog', { name: 'Find a category' }).locator('button[aria-pressed] > span:nth-of-type(2)').allInnerTexts();
    const other = all.map((t) => t.trim()).find((t) => t && !seats.includes(t));
    assert.ok(other, 'a category beyond the seven tiles');
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, 'ios-393-light-7-all.png') }); }
    await page.getByRole('dialog', { name: 'Find a category' }).getByRole('button', { name: other, exact: true }).click();
    await assert.doesNotReject(drawer.locator('[data-category-tile][aria-checked=true]', { hasText: other }).waitFor());
    assert.equal(await said(drawer.locator('[data-save]')), `Save · ₹50 ${other}`);
    ok(`All opens the finder over the drawer; "${other}" takes the last seat and the Save label`);
    // Paid with, inside the Add drawer, opens as vaul's nested drawer and answers the row.
    const payRow = drawer.getByRole('button', { name: /^Paid with/ });
    await payRow.click();
    const tiles = page.getByRole('radiogroup', { name: 'How did you pay' }).getByRole('radio');
    await tiles.nth(1).waitFor();
    if (SHOTS) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, 'ios-393-light-8-nested-pay.png') }); }
    const pick = (await tiles.nth(1).evaluate((el) => el.children[1].children[0].textContent)).trim();
    await tiles.nth(1).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-slot=drawer-content]').length === 1);
    assert.ok((await payRow.innerText()).includes(pick), `Paid with now says ${pick}`);
    assert.ok(await drawer.locator('[data-save]').isVisible());
    ok(`Paid with opens nested over the Add drawer; choosing "${pick}" closes it and answers the row`);
    /* A long answer wraps rather than losing its end (Task 30): the answer is given a 90-character name in the page,
       and the whole of it is still drawn inside the row, on more than one line. */
    const wrap = await payRow.evaluate((row) => {
      const value = [...row.querySelectorAll('span')].find((s) => s.textContent.trim() && !s.children.length && s.className.includes('font-medium'));
      const lineH = value.getBoundingClientRect().height;
      value.textContent = 'HDFC Bank Regalia Gold credit card ending 4321 · UPI through the family phone, shared account';
      const r = value.getBoundingClientRect(), box = row.getBoundingClientRect(), cs = getComputedStyle(value);
      return { overflow: cs.textOverflow, cut: value.scrollWidth > value.clientWidth + 1, lines: r.height / lineH, inside: r.right <= box.right + 0.5 };
    });
    assert.notEqual(wrap.overflow, 'ellipsis', 'the answer is never ellipsised');
    assert.ok(!wrap.cut && wrap.inside && wrap.lines >= 1.9, `a long answer wraps inside the row (${JSON.stringify(wrap)})`);
    ok(`a 90-character answer on Paid with wraps onto ${Math.round(wrap.lines)} lines inside the row, no ellipsis`);
    // When, nested the same way: the month (shadcn Calendar) offers no day after today and no month after this one;
    // the 10th of last month, picked from the grid, answers the row and is the day the entry is saved on.
    const whenRow = drawer.getByRole('button', { name: /^When/ });
    await whenRow.click();
    const month = page.getByRole('dialog', { name: 'Which day was it' });
    await month.getByRole('grid').waitFor();
    assert.equal(await page.locator('[data-slot=drawer-content]').count(), 2, 'the month opens nested over Add');
    assert.equal(await month.getByRole('button', { name: 'Next month' }).getAttribute('aria-disabled'), 'true', 'no month after this one');
    /* Each day as [YYYY-MM-DD, offered]: max is today, there is no min, so every day up to today is offered and every
       day after it is not (a focused disabled day is aria-disabled rather than disabled; both count as not offered). */
    const days = await month.getByRole('grid').locator('button').evaluateAll((b) => b.map((x) =>
      [x.closest('td').dataset.day, !(x.disabled || x.getAttribute('aria-disabled') === 'true'), x.hasAttribute('data-today')]));
    const todayIso = days.find(([, , t]) => t)?.[0];
    assert.ok(todayIso, 'today is in the month shown');
    assert.deepEqual(days.filter(([d, on]) => d > todayIso && on).map(([d]) => d), [], 'no day after today (max) is offered');
    assert.deepEqual(days.filter(([d, on]) => d <= todayIso && !on).map(([d]) => d), [], 'every day up to today is offered');
    assert.ok(days.some(([, on]) => on), 'at least one day is offered');
    const cell = await month.getByRole('grid').locator('button').first().boundingBox();
    assert.ok(cell.width >= 44 && cell.height >= 44, `a day is 44px or more (${cell.width}x${cell.height})`);
    await month.getByRole('button', { name: 'Previous month' }).click();
    const [mName, yName] = (await month.getByRole('grid').getAttribute('aria-label')).split(' ');
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const tenth = `${yName}-${String(MONTHS.indexOf(mName) + 1).padStart(2, '0')}-10`;
    assert.match((await month.getByRole('grid').getByRole('button', { name: /^10 / }).getAttribute('aria-label')), new RegExp(`^10 ${mName}, \\d+ .+ \\d{4}$`), 'the day says its Hijri date');
    await month.getByRole('grid').getByRole('button', { name: /^10 / }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-slot=drawer-content]').length === 1);
    assert.ok((await whenRow.innerText()).includes(`10 ${mName.slice(0, 3)}`), `When now says the 10th (${await whenRow.innerText()})`);
    // Saving an expense remembers how it was paid; put back what this step's Paid with choice overwrote.
    const [{ last_paid_with: paidBefore }] = await sql`select last_paid_with from app_user where id = ${user.id}`;
    await drawer.locator('[data-save]').click();
    await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
    await sql`update app_user set last_paid_with = ${paidBefore} where id = ${user.id}`;
    const [dated] = await waitRows((r) => r.kind === 'expense' && Number(r.amount) === 5000, '50 expense on the 10th');
    assert.equal(dated.occurred_on, tenth);
    ok(`When opens the month nested over Add, nothing after today; the 10th of ${mName} answers the row and the entry is dated ${tenth}`);
    await ctx.close();
  }

  /* ── 8. card Pay after paying BY that card ───────────────────────────── */
  {
    /* The remembered way opens an expense, never a move: last paid by the card, then the card's Pay
       (/add?kind=transfer&to=<card>, no from) must not start From the card itself. */
    const [card] = await sql`select a.id, a.name, (select pm.id from payment_method pm where pm.funding_account_id = a.id
        and pm.archived_at is null limit 1) as rail
      from account a where a.household_id = ${HH} and a.kind = 'credit' and a.archived_at is null limit 1`;
    if (!card) console.log('  skip card Pay: no credit card in these books');
    else {
      const [{ last_paid_with: before }] = await sql`select last_paid_with from app_user where id = ${user.id}`;
      await sql`update app_user set last_paid_with = ${card.rail ? `m:${card.rail}` : `a:${card.id}`} where id = ${user.id}`;
      try {
        const { ctx, page } = await context(ios);
        await page.goto(`${BASE}/add?kind=transfer&to=${card.id}`);
        const from = await page.getByRole('button', { name: /^From/ }).innerText();
        assert.ok(!from.includes(card.name), `From should not be the card: ${from}`);
        await page.getByLabel(/^Amount in/).fill('1500');
        const save = page.locator('[data-save]');
        assert.ok(await save.isEnabled(), 'Save lights for the card\'s Pay');
        assert.equal(await said(save), `Save · ₹1,500 to ${card.name}`);
        ok(`card Pay after paying by the card: From is not the card, "${await said(save)}"`);
        await save.click();
        await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
        const [row] = await waitRows((r) => ['transfer', 'card_payment'].includes(r.kind) && Number(r.amount) === 150000
          && r.counter_account_id === card.id, 'card payment');
        ok(`one ${row.kind} row into the card, as before`);
        await ctx.close();
      } finally {
        await sql`update app_user set last_paid_with = ${before} where id = ${user.id}`;
      }
    }
  }

  /* ── screenshots ─────────────────────────────────────────────────────── */
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    for (const [label, device, vp] of [['ios-393', ios, { width: 393, height: 852 }], ['android-412', pixel, { width: 412, height: 915 }]]) {
      for (const theme of ['light', 'dark']) {
        const { ctx, page } = await context(device, theme, vp);
        const drawer = await openDrawer(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-1-open.png`) });
        await page.keyboard.type('2340');
        await drawer.locator('[data-category-tile]').first().click();
        await page.waitForTimeout(900);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-2-ready.png`) });
        await drawer.getByRole('button', { name: /Note, bill, tab/ }).click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-3-more.png`) });
        await page.goto(`${BASE}/add`);
        await page.getByRole('tab', { name: 'Move' }).click();
        await page.getByLabel(/^Amount in/).fill('15000');
        await page.getByLabel(/^Amount in/).blur();
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-4-move.png`) });
        await page.getByRole('button', { name: /^Paid with|^From/ }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-5-paypicker.png`) });
        await page.keyboard.press('Escape');
        await page.getByRole('tab', { name: 'Income' }).click();
        await page.getByRole('button', { name: /^When/ }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-6-when.png`) });
        await ctx.close();
      }
    }
    ok(`screenshots in ${SHOTS}`);
  }
} finally {
  await browser.close();
  if (!GIVEN) fs.rmSync(STATE, { force: true });
  if (!KEEP && wrote.size) {
    const ids = [...wrote];
    /* Receipts and claims first (they point at entries), then the entries. */
    await sql`delete from txn where id = any(${ids}::uuid[]) and kind = 'claim_receipt'`.catch((e) => console.error(e.message));
    await sql`delete from claim where txn_id = any(${ids}::uuid[])`.catch((e) => console.error(e.message));
    await sql`delete from txn where id = any(${ids}::uuid[])`.catch((e) => console.error(e.message));
    console.log(`  cleaned up ${ids.length} row(s)`);
  }
  await sql.end();
}
console.log(`\n  add-taps: ${n} passed\n`);
