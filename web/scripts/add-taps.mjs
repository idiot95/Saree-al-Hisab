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
   9. The keyboard (v3.1 P1): on an iPhone (visualViewport shrunk by a 336px keyboard, vaul's iOS path) at 393×852
      and in a 659px Safari tab, and on Android (the viewport shrunk to 450px), the amount and each field under More
      are wholly inside what is visible and clear of the sticky Save, and Save itself is above the keyboard.
  10. The amount fits: its type steps down as it grows and the field never clips its text; leaving it adds no ".00";
      2340.5 is saved as 234050 paise.
  11. Add opens on the tap from the phone's kept pickers, before /add has answered, keeps what was typed when the
      route lands, and the kind switch is a radio group the arrow keys move along.
  12. /add never landing: Back, or a close then another tab, or a redirect to sign-in, leaves no drawer and no stale
      cancel; a Save while /add is held is kept on the phone after its wait and lands as one row once let go.

   --only 9,12 runs those sections; --tag before|after names §9's keyboard shots (with --shots dir). §9 finds the
   drawer, its footer and its scroller by role and shape when the data-add-* hooks are absent, so it can be run with
   `--only 9 --tag before` against an older build (afcbad7) and report positions there rather than throw.
   Rows this run wrote are removed at the end unless --keep.                                                   */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { localOwnerUrl } from './local-only.mjs';

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
/** Prefix for the keyboard shots (§9): `--tag before` on the old build, `--tag after` on this one. */
const TAG = arg('--tag');
/** Only these sections, e.g. `--only 9` (to run the keyboard checks against an older build). */
const ONLY = arg('--only')?.split(',');
const want = (n) => !ONLY || ONLY.includes(String(n));
const KEEP = argv.includes('--keep');

const url = localOwnerUrl(ROOT);
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

/** A phone. `keyboard` (iPhone only) stands in for its keyboard the way the audit did: window.visualViewport becomes a
 *  stub that is `keyboard` px shorter than the window while a text field has focus and fires `resize` as it comes and
 *  goes, and navigator.platform says iPhone, so vaul runs its real iOS repositioning against the real drawer. */
async function context(device, theme = 'light', viewport, keyboard = 0) {
  const ctx = await browser.newContext({ ...device, storageState: STATE, ...(viewport ? { viewport, screen: viewport } : {}) });
  if (keyboard) {
    await ctx.addInitScript((KB) => {
      Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' });
      const t = new EventTarget(); let open = false;
      const vv = { get height() { return innerHeight - (open ? KB : 0); }, get width() { return innerWidth; }, offsetTop: 0, offsetLeft: 0,
        pageTop: 0, pageLeft: 0, scale: 1, addEventListener: t.addEventListener.bind(t), removeEventListener: t.removeEventListener.bind(t),
        dispatchEvent: t.dispatchEvent.bind(t) };
      Object.defineProperty(window, 'visualViewport', { get: () => vv });
      const typing = (e) => e && (e.tagName === 'TEXTAREA' || (e.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file'].includes(e.type)));
      document.addEventListener('focusin', (e) => { if (typing(e.target) && !open) { open = true; setTimeout(() => t.dispatchEvent(new Event('resize')), 50); } }, true);
      document.addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement) && open) { open = false; t.dispatchEvent(new Event('resize')); } }, 0), true);
    }, keyboard);
  }
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
 *  the pickers used to stop at 80vh, and only the newer drawers had a Close) — except the Add drawer on an iPhone,
 *  which stops at 79% so vaul lifts it clear of the keyboard (v3.1 P1; under 80% vaul takes the branch that does). */
async function drawerHasCloseAndCap(page, drawer, what, share = 0.86) {
  await drawer.getByRole('button', { name: 'Close', exact: true }).first().waitFor();
  const { cap, vh } = await drawer.evaluate((el) => ({ cap: parseFloat(getComputedStyle(el).maxHeight), vh: innerHeight }));
  assert.ok(Math.abs(cap - vh * share) <= 1, `${what}: capped at ${Math.round(share * 100)}dvh (${cap}px of ${vh}px)`);
}
/** The kind switch: Expense · Income · Move, a radio group. */
const kindRadio = (page, name) => page.getByRole('radiogroup', { name: 'Kind of entry' }).getByRole('radio', { name, exact: true });
const keysFor = (minor) => (minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2));

try {
  /* ── 1. three taps ───────────────────────────────────────────────────── */
  if (want(1)) {
    const { ctx, page } = await context(ios);
    const drawer = await openDrawer(page);
    await drawerHasCloseAndCap(page, drawer, 'the Add drawer (iPhone)', 0.79);
    let taps = 0;
    await page.keyboard.type('2340'); taps++;                       // 1: the amount
    const tile = drawer.locator('[data-category-tile]').first();
    const name = (await tile.locator('span').last().innerText()).trim();
    await tile.click(); taps++;                                      // 2: the first tile
    const save = drawer.locator('[data-save]');
    await assert.doesNotReject(save.waitFor());
    const label = await said(save);
    assert.equal(label, `Save · ₹2,340 ${name}`);
    assert.equal(await drawer.locator('number-flow-react').count(), 0, 'nothing in the Add drawer rolls: the amount, its echo and Save are static');
    assert.equal(await drawer.locator('[data-figure-echo]').count(), 0, 'the echo line under the amount is gone');
    ok(`Save reads "${label}"`);
    await save.click(); taps++;                                      // 3: Save
    assert.equal(taps, 3);
    await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
    ok('three interactions after the drawer opens, then "Entry saved." (the drawer has a Close button and a 79dvh cap on an iPhone)');
    const [row] = await waitRows((r) => r.kind === 'expense' && Number(r.amount) === 234000, '2340 expense');
    assert.ok(row.category_id);
    ok('one new expense row of ₹2,340 with its category');
    const [{ last_paid_with: lp }] = await sql`select last_paid_with from app_user where id = ${user.id}`;
    assert.match(lp ?? '', /^[am]:/);
    ok(`last_paid_with remembered (${lp.slice(0, 2)}…)`);
    /* Edit on the saved snack is one navigation, a push to the entry: closing the snack no longer also replaces the
       address (that replace's Back mark could be spent by the push). Back from the entry says nothing again and
       only takes ?saved= off, and the trail ends where the history does: at Home. */
    /* Every address change from the Edit tap on is logged: Edit must be exactly one push, with no replace of Home
       under it (under `next dev`'s StrictMode the snack's re-render once re-read storage, saw its own "handled"
       mark and fired the tidy replace('/') on top of the push). */
    await page.evaluate(() => {
      window.__navs = [];
      for (const kind of ['pushState', 'replaceState']) {
        const real = history[kind].bind(history);
        history[kind] = (s, t, u) => {
          if (u != null) {
            const to = new URL(String(u), location.href);
            const from = location.pathname + location.search;
            if (to.pathname + to.search !== from) window.__navs.push(`${kind === 'pushState' ? 'push' : 'replace'} ${to.pathname}`);
          }
          return real(s, t, u);
        };
      }
    });
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.waitForURL((u) => u.pathname === `/entries/${row.id}`, { timeout: 15000 });
    await page.waitForTimeout(1500);
    assert.equal(new URL(page.url()).pathname, `/entries/${row.id}`, 'still on the entry after Edit settles');
    const navs = await page.evaluate(() => window.__navs);
    assert.deepEqual(navs, [`push /entries/${row.id}`], `Edit is a single push and nothing else (${JSON.stringify(navs)})`);
    /* Watch the whole way back, not only the end: any "Entry saved." put into the page from the Back press until the
       clean address (even for one frame, before the ?saved= comes off) is caught by the observer. The page is not
       reloaded on Back, so the observer lives through it. */
    await page.evaluate(() => {
      window.__sawSaved = [];
      const look = () => { if (document.body.innerText.includes('Entry saved.')) window.__sawSaved.push(location.href); };
      new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await page.getByRole('link', { name: 'Back' }).first().click();
    await page.waitForURL((u) => u.pathname === '/' && !u.searchParams.has('saved'), { timeout: 15000 });
    await page.waitForTimeout(800);
    const flashes = await page.evaluate(() => window.__sawSaved);
    assert.deepEqual(flashes, [], `"Entry saved." never appeared on the way back (${JSON.stringify(flashes)})`);
    assert.equal(await page.getByText('Entry saved.').count(), 0, 'no second "Entry saved." on the way back');
    const trailNow = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ql.trail.v1') ?? '[]'));
    assert.equal(trailNow.at(-1), '/', `the trail ends at Home (${JSON.stringify(trailNow)})`);
    assert.ok(!trailNow.some((u) => u.startsWith('/?saved=')), `and holds no ?saved= step (${JSON.stringify(trailNow)})`);
    /* Back itself is a pop, not a push; the only address change after it is the one tidy replace that takes ?saved=
       off (StrictMode's second effect run must not send a second one). */
    const navsAfter = await page.evaluate(() => window.__navs);
    assert.deepEqual(navsAfter, [`push /entries/${row.id}`, 'replace /'], `Back then one tidy replace of Home (${JSON.stringify(navsAfter)})`);
    ok('Edit on the saved snack opens the entry; Back returns to a clean Home, the trail in step');
    /* Two fresh saves in a row on the same Home (no reload): each says "Entry saved.", the second while the first's
       snack is still up. The answer is kept per instance, so a handled ?saved= earlier in the visit cannot quiet them. */
    for (const minor of [234100, 234200]) {
      await page.locator('a[href="/add"]').first().click();
      const d = page.locator('[data-slot=drawer-content]');
      await d.getByLabel(/^Amount in/).waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Amount in'));
      await page.keyboard.type(keysFor(minor));
      await d.locator('[data-category-tile]').first().click();
      await d.locator('[data-save]').click();
      const [r] = await waitRows((x) => x.kind === 'expense' && Number(x.amount) === minor, `${minor} expense`);
      await page.waitForURL((u) => u.pathname === '/' && u.searchParams.get('saved') === r.id, { timeout: 15000 });
      await page.getByText('Entry saved.').waitFor({ timeout: 5000 });
    }
    ok('two fresh saves in a row on the same Home each say "Entry saved."');
    await ctx.close();
  }

  /* ── 2. income that clears a claim ───────────────────────────────────── */
  if (want(2)) {
    const claims = await sql`
      select cs.id, cs.outstanding::bigint as o from claim_state cs join txn t on t.id = cs.txn_id and t.deleted_at is null
      where cs.household_id = ${HH} and cs.status in ('open','part_paid') and cs.outstanding > 0 order by t.occurred_on`;
    if (!claims.length) console.log('  skip income: no open claim in these books');
    else {
      const target = Number(claims[0].o);
      const same = claims.filter((c) => Number(c.o) === target).map((c) => c.id);
      const { ctx, page } = await context(ios);
      await page.goto(`${BASE}/add`);
      await kindRadio(page, 'Income').click();
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
  if (want(3)) {
    const { ctx, page } = await context(pixel);
    await page.goto(`${BASE}/add`);
    await kindRadio(page, 'Move').click();
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
  if (want(4)) {
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
  if (want(5)) {
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
  if (want(6)) {
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
  if (want(7)) {
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
  if (want(8)) {
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

  /* ── 9. the keyboard, on an iPhone and on Android ─────────────────────── */
  /* Positions, not hooks: the drawer, its footer and its scroller are found by role and shape first (the hooks are only
     a preference), so on a build without them — afcbad7, say — this reports where things were rather than throwing.
     Every case's problems are collected and reported together. */
  if (want(9)) {
    const KB = 336;
    const where = (page, which) => page.evaluate((which) => {
      const vv = window.visualViewport;
      const amount = document.querySelector('[data-slot=drawer-content] input[aria-label^="Amount in"]');
      const drawer = document.querySelector('[data-add-drawer]') ?? amount?.closest('[data-slot=drawer-content]');
      const el = which === 'amount' ? amount : document.activeElement;
      const save = drawer.querySelector('[data-save]') ?? [...drawer.querySelectorAll('button')].find((x) => /^Save\b/.test(x.textContent.trim()));
      const footer = drawer.querySelector('[data-add-footer]') ?? save.parentElement;
      const scrolls = (n) => /(auto|scroll)/.test(getComputedStyle(n).overflowY);
      let scroller = drawer.querySelector('[data-add-scroll]');
      if (!scroller) { scroller = el.parentElement; while (scroller && scroller !== drawer && !scrolls(scroller)) scroller = scroller.parentElement; }
      const r = el.getBoundingClientRect(), s = save.getBoundingClientRect();
      return { top: Math.max(vv.offsetTop, scroller.getBoundingClientRect().top), bottom: vv.offsetTop + vv.height,
        field: [r.top, r.bottom], foot: footer.getBoundingClientRect().top, save: [s.top, s.bottom],
        drawer: drawer.getBoundingClientRect().top, cap: parseFloat(getComputedStyle(drawer).maxHeight), vh: innerHeight,
        name: el.getAttribute('aria-label') ?? el.getAttribute('placeholder'), pad: getComputedStyle(footer).paddingBottom };
    }, which);
    const tag = TAG ? `${TAG}-` : '';
    const allProblems = [];
    for (const [label, file, device, vp, os] of [
      ['iPhone 393×852', 'iphone-393x852', ios, { width: 393, height: 852 }, 'ios'],
      ['iPhone Safari tab 393×659', 'iphone-393x659-safari', ios, { width: 393, height: 659 }, 'ios'],
      ['Pixel 412×915', 'pixel-412x915', pixel, { width: 412, height: 915 }, 'android'],
    ]) {
      const problems = [];
      const clear = (m, what) => {
        const f = m.field.map(Math.round);
        if (!(m.field[0] >= m.top - 0.5 && m.field[1] <= m.foot + 0.5)) {
          problems.push(`${what}: "${m.name}" at ${f} is not wholly visible above Save (visible from ${Math.round(m.top)}, footer from ${Math.round(m.foot)})`);
        }
        if (!(m.save[0] >= m.top && m.save[1] <= m.bottom + 0.5)) {
          problems.push(`${what}: Save at ${m.save.map(Math.round)} is not above the keyboard (visible to ${Math.round(m.bottom)})`);
        }
      };
      const { ctx, page } = await context(device, 'light', vp, os === 'ios' ? KB : 0);
      await openDrawer(page);
      const drawer = page.locator('[data-slot=drawer-content]').filter({ has: page.getByLabel(/^Amount in/) });
      const share = os === 'ios' ? 0.79 : 0.86;
      const shot = async (what) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${tag}${file}-kb-${what}.png`) }); } };
      const kb = async () => { if (os === 'android') await page.setViewportSize({ width: vp.width, height: 450 }); await page.waitForTimeout(450); };
      const down = async () => { if (os === 'android') await page.setViewportSize(vp); await page.waitForTimeout(150); };
      await kb();
      await page.keyboard.type('234050');
      const m = await where(page, 'amount');
      if (Math.abs(m.cap - m.vh * share) > 1) problems.push(`the Add drawer is capped at ${m.cap}px, not ${Math.round(share * 100)}dvh of ${m.vh}px`);
      clear(m, 'amount');
      if (os === 'ios') {
        if (!(m.drawer <= 27)) problems.push(`vaul did not lift the drawer to the top of what is visible (top ${Math.round(m.drawer)})`);
        if (m.pad !== '10px') problems.push(`home-indicator padding under Save while the keyboard is up (${m.pad})`);
      }
      await shot('amount');
      await drawer.getByLabel(/^Amount in/).evaluate((e) => e.blur());
      await down();
      await drawer.getByRole('button', { name: /Note, bill, tab/ }).click();
      for (const [name, ph] of [['Where', /shop or place/], ['Remarks', /Anything worth/]]) {
        const field = drawer.getByPlaceholder(ph);
        await field.focus();
        await kb();
        await page.keyboard.type('Corner shop');
        await page.waitForTimeout(150);
        clear(await where(page, 'active'), name);
        await shot(name.toLowerCase());
        await field.evaluate((e) => e.blur());
        await down();
      }
      /* The category finder, opened from Add with its search box focused: the same cap, lifted the same way. */
      await drawer.getByRole('button', { name: 'All categories' }).click();
      const finder = page.getByRole('dialog', { name: 'Find a category' });
      const search = finder.getByRole('searchbox', { name: 'Find a category' });
      await search.waitFor();
      await kb();
      await page.waitForTimeout(300);
      const fm = await finder.evaluate((d) => {
        const vv = window.visualViewport, box = d.querySelector('input[type=search]').getBoundingClientRect();
        return { top: d.getBoundingClientRect().top, cap: parseFloat(getComputedStyle(d).maxHeight), vh: innerHeight,
          box: [box.top, box.bottom], bottom: vv.offsetTop + vv.height, focused: document.activeElement?.type === 'search' };
      });
      if (!fm.focused) problems.push('the finder\'s search box is not focused');
      if (Math.abs(fm.cap - fm.vh * share) > 1) problems.push(`the category finder is capped at ${fm.cap}px, not ${Math.round(share * 100)}dvh of ${fm.vh}px`);
      if (!(fm.box[0] >= 0 && fm.box[1] <= fm.bottom)) problems.push(`the finder's search box at ${fm.box.map(Math.round)} is not above the keyboard (to ${Math.round(fm.bottom)})`);
      if (os === 'ios' && !(fm.top <= 27)) problems.push(`vaul did not lift the category finder (top ${Math.round(fm.top)})`);
      await shot('finder');
      await down();
      await ctx.close();
      if (problems.length) allProblems.push(`${label}:\n      ${problems.join('\n      ')}`);
      else ok(`${label}, keyboard up: the amount, Where and Remarks are each wholly visible above Save, Save above the keyboard, and the category finder's search is lifted clear of it`);
    }
    assert.deepEqual(allProblems, [], `the keyboard covers what is being typed:\n    ${allProblems.join('\n    ')}`);
  }

  /* ── 10. the amount fits, and keeps its paise ─────────────────────────── */
  if (want(10)) {
    for (const width of [393, 360]) {
      const { ctx, page } = await context(ios, 'light', { width, height: 800 });
      const drawer = await openDrawer(page);
      const amount = drawer.getByLabel(/^Amount in/);
      const sizes = [];
      for (const [keys, shown] of [['2340', '2,340'], ['234050', '2,34,050'], ['234050.50', '2,34,050.50'], ['1234567.50', '12,34,567.50'], ['999999999.99', '99,99,99,999.99']]) {
        await amount.fill('');
        await amount.pressSequentially(keys);
        assert.equal(await amount.inputValue(), shown);
        const fit = await amount.evaluate((el) => {
          const r = el.getBoundingClientRect(), box = el.closest('[data-add-drawer]').getBoundingClientRect();
          return { cut: el.scrollWidth > el.clientWidth + 1, inside: r.left >= box.left && r.right <= box.right, size: parseFloat(getComputedStyle(el).fontSize) };
        });
        assert.ok(!fit.cut && fit.inside, `${width}px, ${shown}: the whole amount is drawn (${JSON.stringify(fit)})`);
        sizes.push(fit.size);
      }
      assert.deepEqual(sizes, [52, 52, 42, 34, 28], `${width}px: the type steps down as the amount grows (${sizes})`);
      ok(`${width}px: every length of amount is drawn whole, at ${[...new Set(sizes)].join(' → ')}px`);
      if (width === 393) {
        await amount.fill('');
        await amount.pressSequentially('2340');
        await amount.blur();
        assert.equal(await amount.inputValue(), '2,340', 'a whole amount gains no ".00" when the field is left');
        await amount.fill('');
        await amount.pressSequentially('2340.5');
        await amount.blur();
        assert.equal(await amount.inputValue(), '2,340.50', 'paise are written out once there are some');
        await drawer.locator('[data-category-tile]').first().click();
        assert.match(await said(drawer.locator('[data-save]')), /^Save · ₹2,340\.50 /);
        await drawer.locator('[data-save]').click();
        await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
        const [row] = await waitRows((r) => r.kind === 'expense' && Number(r.amount) === 234050, '2340.5 expense');
        assert.equal(Number(row.amount), 234050);
        ok('leaving the field adds no ".00" to 2,340; 2340.5 reads 2,340.50 and is saved as 234050 paise');
      }
      await ctx.close();
    }
  }

  /* ── 11. Add opens on the tap; the kind switch takes the arrow keys ────── */
  if (want(11)) {
    const { ctx, page } = await context(ios);
    /* The route held back, so what is on screen before it answers is what the tap drew by itself. */
    let hold = 0;
    await page.route((u) => new URL(u).pathname === '/add', async (route) => {
      if (route.request().headers()['rsc'] && hold) await new Promise((r) => setTimeout(r, hold));
      await route.continue();
    });
    // A first open with signal, as on any phone that has opened Add before: its pickers are kept.
    let drawer = await openDrawer(page);
    await page.waitForFunction(() => !!localStorage.getItem('ql.pickers.v1'));
    await page.keyboard.press('Escape');
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 });
    await page.locator('[data-add-drawer]').waitFor({ state: 'detached' });
    hold = 2500;
    // Home afresh, so the router has forgotten the /add it fetched and the tap really waits on the held route.
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    const t0 = Date.now();
    await page.locator('a[href="/add"]').first().click();
    drawer = page.locator('[data-add-drawer]');
    await drawer.getByLabel(/^Amount in/).waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Amount in'));
    const opened = Date.now() - t0;
    assert.notEqual(new URL(page.url()).pathname, '/add', 'focused before /add landed');
    assert.ok(opened < 1500, `the drawer and its focused amount are up before the route answers (${opened}ms, route held 2500ms)`);
    const settled = await page.evaluate(() => new Promise((res) => {
      const el = document.querySelector('[data-add-drawer]'); const t = performance.now();
      const look = () => (el.getAnimations().every((a) => a.playState !== 'running') ? res(Math.round(performance.now() - t)) : requestAnimationFrame(look));
      look();
    }));
    await page.keyboard.type('58');
    assert.equal(await drawer.locator('[data-category-tile]').count() > 0, true, 'the tiles are there from the phone\'s pickers');
    await page.waitForURL((u) => u.pathname === '/add', { timeout: 10000 });
    await page.waitForTimeout(800);
    assert.equal(await page.locator('[data-slot=drawer-content]').count(), 1, 'one drawer once the route lands, not two');
    assert.equal(await drawer.getByLabel(/^Amount in/).inputValue(), '58', 'what was typed before the route landed is kept');
    ok(`Add opens on the tap from the kept pickers (focused in ${opened}ms with the route held 2.5s; slide done ${settled}ms later), and the route's arrival keeps the "58" typed`);
    /* The kind switch: one Tab stop, the arrows move the choice and focus. */
    const expense = kindRadio(page, 'Expense');
    assert.equal(await expense.getAttribute('aria-checked'), 'true');
    assert.equal(await kindRadio(page, 'Income').getAttribute('tabindex'), '-1', 'only the chosen kind is a Tab stop');
    await expense.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await kindRadio(page, 'Income').getAttribute('aria-checked'), 'true');
    assert.ok(await kindRadio(page, 'Income').evaluate((e) => e === document.activeElement), 'focus follows to Income');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await kindRadio(page, 'Move').getAttribute('aria-checked'), 'true', 'ArrowLeft from Expense wraps to Move');
    await page.keyboard.press('Home');
    assert.equal(await expense.getAttribute('aria-checked'), 'true');
    ok('the kind switch is a radio group: one Tab stop, arrows and Home move the choice and the focus');
    // Put away, the address steps back to Home and the drawer goes with it.
    await drawer.getByRole('button', { name: 'Close', exact: true }).first().click();
    await page.waitForURL((u) => u.pathname === '/', { timeout: 10000 });
    await page.locator('[data-add-drawer]').waitFor({ state: 'detached' });
    /* Put away BEFORE the route answers: when it does, it is stepped back off at once — Home, no drawer. */
    await page.goto(`${BASE}/`);
    await page.locator('a[href="/add"]').first().click();
    await page.locator('[data-add-drawer]').getByLabel(/^Amount in/).waitFor();
    assert.notEqual(new URL(page.url()).pathname, '/add', 'put away before /add landed');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(hold + 1500);
    assert.equal(new URL(page.url()).pathname, '/', `closed before the route arrived, the address ends at Home (${page.url()})`);
    assert.equal(await page.locator('[data-slot=drawer-content]').count(), 0, 'and no drawer is left open');
    ok('closed before /add answered, the drawer stays shut and the address comes back to Home');
    await ctx.close();
  }
  /* A phone that has never opened Add: the drawer still opens on the tap, holding the form's frame until the route
     answers, then the form. */
  if (want(11)) {
    const { ctx, page } = await context(pixel);
    await page.route((u) => new URL(u).pathname === '/add', async (route) => {
      if (route.request().headers()['rsc']) await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(`${BASE}/`);
    await page.evaluate(() => localStorage.removeItem('ql.pickers.v1'));
    await page.locator('a[href="/add"]').first().click();
    await page.locator('[data-add-drawer] [data-frame]').waitFor({ timeout: 1000 });
    await page.locator('[data-add-drawer]').getByLabel(/^Amount in/).waitFor({ timeout: 15000 });
    assert.equal(await page.locator('[data-slot=drawer-content]').count(), 1);
    ok('with nothing kept on the phone, the drawer opens on the tap with the form\'s frame, then the form');
    await ctx.close();
  }

  /* ── 12. a drawer whose /add never lands, and a Save while it is on its way ── */
  if (want(12)) {
    /* The /add route (its RSC request) held at a gate the test opens. */
    const held = async (page) => {
      const g = { open: null };
      g.wait = new Promise((r) => { g.open = r; });
      await page.route((u) => new URL(u).pathname === '/add', async (route) => {
        if (!route.request().headers()['rsc']) return route.continue();
        await g.wait;
        await route.continue().catch(() => {});
      });
      g.reset = () => { g.wait = new Promise((r) => { g.open = r; }); };
      return g;
    };
    const noDrawer = async (page) => assert.equal(await page.locator('[data-slot=drawer-content]').count(), 0, 'no drawer is left open');
    const plus = (page) => page.locator('nav[aria-label=Main] a[href="/add"]').click();
    /* Open Add once so the phone keeps its pickers, then load Home afresh: the router forgets the /add it just
       fetched, so the next tap really does wait on the held route. */
    const warm = async (page) => {
      await openDrawer(page);
      await page.keyboard.press('Escape');
      await page.waitForURL((u) => u.pathname === '/');
      await page.goto(`${BASE}/`);
    };
    /* The drawer is up and the address is not /add yet: it was opened by the tap, ahead of the route. */
    const ahead = async (page) => {
      await page.locator('[data-add-drawer]').getByLabel(/^Amount in/).waitFor();
      assert.notEqual(new URL(page.url()).pathname, '/add', 'the drawer is up before /add has landed');
    };

    // Back before /add answers: the drawer goes with the screen Back leads to, and nothing comes back later.
    {
      const { ctx, page } = await context(pixel);
      await openDrawer(page);                        // keep the pickers
      await page.keyboard.press('Escape');
      await page.waitForURL((u) => u.pathname === '/');
      await page.goto(`${BASE}/entries`);
      await page.locator('nav[aria-label=Main] a[href="/"]').click();
      await page.waitForURL((u) => u.pathname === '/');
      const g = await held(page);
      await plus(page);
      await ahead(page);
      await page.goBack();
      await page.waitForURL((u) => u.pathname === '/entries', { timeout: 10000 });
      await page.locator('[data-add-drawer]').waitFor({ state: 'detached', timeout: 5000 });
      g.open();
      await page.waitForTimeout(1500);
      assert.equal(new URL(page.url()).pathname, '/entries', 'Back went where Back goes, and stayed there');
      await noDrawer(page);
      ok('Back before /add answered: the drawer goes with the screen, and the dropped /add never reopens it');
      await ctx.close();
    }

    // Closed before /add answered, then another tab: the next /add opened another way (a tab's Add cost) shows normally.
    {
      const [tab] = await sql`select id from ledger_book where household_id = ${HH} and closed_at is null limit 1`;
      const { ctx, page } = await context(ios);
      await warm(page);
      const g = await held(page);
      await plus(page);
      await ahead(page);
      await page.keyboard.press('Escape');            // put away before the route answered
      await page.locator('nav[aria-label=Main] a[href="/people"]').click();
      await page.waitForURL((u) => u.pathname === '/people', { timeout: 10000 });
      g.open();
      if (!tab) console.log('  skip Add cost: no open tab');
      else {
        await page.locator(`a[href="/tab/${tab.id}"]`).first().click();
        await page.waitForURL((u) => u.pathname === `/tab/${tab.id}`, { timeout: 10000 });
        await page.locator(`a[href="/add?tab=${tab.id}"]`).first().click();
        await page.waitForURL((u) => u.pathname === '/add', { timeout: 10000 });
        await page.locator('[data-slot=drawer-content]').getByLabel(/^Amount in/).waitFor({ timeout: 10000 });
        await page.waitForTimeout(1500);
        assert.equal(new URL(page.url()).pathname, '/add', `the Add cost drawer is not bounced back (${page.url()})`);
        assert.equal(await page.locator('[data-slot=drawer-content]').count(), 1, 'its drawer shows');
        ok('closed before /add answered, then another tab: the next Add cost opens its drawer normally');
      }
      await ctx.close();
    }

    // A redirect to /signin while /add is on its way (the session expired): the drawer does not stay over sign-in.
    {
      const { ctx, page } = await context(ios);
      await warm(page);
      const g = await held(page);
      await plus(page);
      await ahead(page);
      /* The session ends while /add is on its way ("Sign out everywhere" moves this epoch), so the route answers with
         sign-in. Put back afterwards, which makes the run's own session good again. */
      const [{ v: epoch }] = await sql`select sessions_valid_from as v from app_user where id = ${user.id}`;
      await sql`update app_user set sessions_valid_from = now() + interval '1 minute' where id = ${user.id}`;
      try {
        g.open();
        await page.waitForURL((u) => u.pathname.startsWith('/signin'), { timeout: 15000 });
        await page.waitForTimeout(800);
        await noDrawer(page);
      } finally {
        await sql`update app_user set sessions_valid_from = ${epoch} where id = ${user.id}`;
      }
      ok('the session ended while /add was on its way: it went to sign-in, and the drawer went with the screen');
      await ctx.close();
    }

    // Save while /add is still on its way: kept on the phone after the wait, and one row once the route is let go.
    {
      const { ctx, page } = await context(ios);
      await warm(page);
      const [{ t: caseStart }] = await sql`select now() as t`;
      const g = await held(page);
      await plus(page);
      await ahead(page);
      const drawer = page.locator('[data-add-drawer]');
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Amount in'));
      await page.keyboard.type('443');
      await drawer.locator('[data-category-tile]').first().click();
      const t0 = Date.now();
      await drawer.locator('[data-save]').click();
      await drawer.getByText(/kept on this phone/).waitFor({ timeout: 12000 });
      const waited = Date.now() - t0;
      assert.ok(waited >= 7500, `kept only after Save's wait (${waited}ms)`);
      const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]'));
      assert.equal(queued.length, 1, 'one entry kept on the phone');
      const ref = queued[0].clientRef;
      assert.match(ref, /^[0-9a-f-]{36}$/);
      ok(`Save with /add still on its way: after ${(waited / 1000).toFixed(1)}s the entry is kept on the phone (clientRef ${ref.slice(0, 8)}…)`);
      /* From the release on, every snack and alert the page shows is noted: only the queue's own "is in the books" may
         appear — no "Entry saved." from the save that waited, no refusal. */
      await page.evaluate(() => {
        window.__said = [];
        const look = () => {
          for (const el of document.querySelectorAll('[role=status], [role=alert]')) {
            const t = el.textContent.trim();
            if (t && !window.__said.includes(t)) window.__said.push(t);
          }
          if (document.body.innerText.includes('Entry saved.') && !window.__said.includes('Entry saved.')) window.__said.push('Entry saved.');
        };
        new MutationObserver(look).observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      g.open();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('ql.queue.v1') ?? '[]').length === 0, null, { timeout: 30000 });
      await page.waitForTimeout(2000);
      // Every row of that amount this person made since the case began: exactly one, whatever its client_ref.
      const rows = await sql`select id, client_ref from txn where household_id = ${HH} and created_by = ${user.id}
        and created_at >= ${caseStart} and amount = 44300`;
      rows.forEach((r) => wrote.add(r.id));
      assert.equal(rows.length, 1, `exactly one ₹443 row made during the case (${rows.length})`);
      assert.equal(rows[0].client_ref, ref, 'and it carries the kept clientRef');
      const said = await page.evaluate(() => window.__said);
      const extra = said.filter((t) => !/kept on this phone is in the books\.|kept on this phone\. It goes into the books/.test(t));
      assert.deepEqual(extra, [], `after the release nothing but the queue's own line was said (${JSON.stringify(said)})`);
      assert.ok(said.some((t) => /is in the books/.test(t)), `the queue said it is in the books (${JSON.stringify(said)})`);
      ok('let go: exactly one ₹443 row was made during the case (the kept clientRef), and the only line after it is the queue\'s "is in the books"');
      await ctx.close();
    }

    // Closed before a slow /add landed (12s): when it does land, it is stepped back off — no drawer, back on Home.
    {
      const { ctx, page } = await context(ios);
      await warm(page);
      const g = await held(page);
      await plus(page);
      await ahead(page);
      await page.keyboard.press('Escape');
      await page.locator('[data-add-drawer]').waitFor({ state: 'detached' });
      await page.waitForTimeout(12000);
      const landed = page.waitForURL((u) => u.pathname === '/add', { timeout: 15000 }).then(() => true, () => false);
      g.open();
      const reached = await landed;
      await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });
      await page.waitForTimeout(1500);
      assert.equal(new URL(page.url()).pathname, '/', `back on Home (${page.url()})`);
      await noDrawer(page);
      ok(`closed before /add answered and it answered 12s later${reached ? ' (it landed, and was stepped back off)' : ''}: the drawer stays shut, Home is where it was`);
      await ctx.close();
    }

    // Closed before landing, then the person asks for /add again on the same screen (Activity's empty state): it opens.
    {
      const { ctx, page } = await context(ios);
      await openDrawer(page);
      await page.keyboard.press('Escape');
      await page.waitForURL((u) => u.pathname === '/');
      const empty = `${BASE}/entries?m=2001-01`;
      await page.goto(empty);
      const again = page.getByRole('link', { name: 'Add an entry' });
      await again.waitFor();
      const g = await held(page);
      await plus(page);
      await ahead(page);
      await page.keyboard.press('Escape');
      await page.locator('[data-add-drawer]').waitFor({ state: 'detached' });
      await again.click();
      g.open();
      await page.waitForURL((u) => u.pathname === '/add', { timeout: 15000 });
      await page.locator('[data-slot=drawer-content]').getByLabel(/^Amount in/).waitFor({ timeout: 10000 });
      await page.waitForTimeout(1500);
      assert.equal(new URL(page.url()).pathname, '/add', `the asked-for /add stays (${page.url()})`);
      assert.equal(await page.locator('[data-slot=drawer-content]').count(), 1, 'its drawer is open');
      ok('closed before landing, then Activity\'s "Add an entry" on the same screen: that /add opens and stays');
      await ctx.close();
    }
  }

  /* ── screenshots ─────────────────────────────────────────────────────── */
  if (SHOTS && !ONLY) {
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
        await kindRadio(page, 'Move').click();
        await page.getByLabel(/^Amount in/).fill('15000');
        await page.getByLabel(/^Amount in/).blur();
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-4-move.png`) });
        await page.getByRole('button', { name: /^Paid with|^From/ }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(SHOTS, `${label}-${theme}-5-paypicker.png`) });
        await page.keyboard.press('Escape');
        await kindRadio(page, 'Income').click();
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
