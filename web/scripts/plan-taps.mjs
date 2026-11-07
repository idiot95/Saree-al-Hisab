#!/usr/bin/env node
/* Plan (/budget), the budget and the trends on one screen, against a running build.

     node scripts/plan-taps.mjs [--state file] [--keep]

   Env: PLAN_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local.
   --state is a signed-in Playwright storage state for an owner or contributing member (default .sweep-state.json).

   1. /trends?m=… redirects to /budget?m=…#trends, keeping its params, and Plan has the #trends section.
   2. Create a budget in two steps with "Make this my current budget" unticked. It is refused once (the last month
      before the first), keeping what was typed and the box unticked; put right and sent again, it is kept for
      later: not in use, and this month's budget rows are unchanged.
   3. Make it current from its open row; it wears "In use" and the month's figures appear with its category bar.
   4. Open "Adjust <month> only", save a smaller figure for that category, and the bar on the page changes —
      over budget, with the word.
   5. Create another budget with "Make this my current budget" ticked: no 5xx, budget_set.current_at is set (and it is
      the only current set), its row wears "In use", and this month's budget rows equal its lines.
   The budget set this run made is deleted and this month's and later budget rows are put back as they were,
   unless --keep.                                                                                              */
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
const BASE = (process.env.PLAN_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const KEEP = argv.includes('--keep');

const sql = postgres(localOwnerUrl(ROOT), { ssl: 'require', max: 1, onnotice: () => {} });

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const strip = (d) => { const { defaultBrowserType, ...rest } = d; void defaultBrowserType; return rest; };
const IOS = { ...strip(devices['iPhone 13']), viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...IOS, storageState: STATE });
const page = await ctx.newPage();

const NAME = `Plan taps ${Date.now().toString(36)}`;
const NAME2 = `${NAME} current`;
const now = new Date();
const MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
const monthLong = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/* Whose books the state signs into, and what their budget rows look like from this month on, to put back. */
let hh = null;
let saved = [];
let wasCurrent = [];
const EMAIL = process.env.PLAN_EMAIL || 'ammar@example.com';

try {
  /* ── 1. the old address ───────────────────────────────────────────── */
  await page.goto(`${BASE}/trends?m=2026-09-01&x=1`);
  await page.waitForURL((u) => u.pathname === '/budget' && u.search === '?m=2026-09-01&x=1' && u.hash === '#trends');
  await page.locator('#trends').getByRole('heading', { name: 'Trends' }).waitFor();
  ok('/trends?m= redirects to /budget?m=…#trends with its params, and Plan has the Trends section');

  await page.goto(`${BASE}/budget`);
  await page.getByRole('heading', { name: 'Plan' }).waitFor();
  const sets = page.getByRole('region', { name: 'Your budgets' });
  if (await sets.count()) await page.getByRole('button', { name: 'Create another budget' }).click();

  /* Whose books: the signed-in person's household (PLAN_EMAIL, the sweep's login by default). */
  [{ hh }] = await sql`select active_household_id as hh from app_user where lower(email) = lower(${EMAIL})`;
  saved = await sql`select category_id, month, amount from budget where household_id = ${hh} and month >= ${MONTH}::date`;
  wasCurrent = await sql`select id, current_at from budget_set where household_id = ${hh} and current_at is not null`;
  const group = page.getByRole('group', { name: 'Which categories to budget' });
  /* The top-level category with the most spent this month, so the smaller figure saved later is over budget. */
  const [top] = await sql`select coalesce(p.name, c.name) as name, sum(s.amount) as spent
    from spend_txn s join category c on c.id = s.category_id left join category p on p.id = c.parent_id
    where s.household_id = ${hh} and s.occurred_on >= ${MONTH}::date and s.occurred_on < (${MONTH}::date + interval '1 month')
    group by 1 order by 2 desc limit 1`;
  const first = top ? group.getByRole('button', { name: top.name, exact: true }) : group.getByRole('button').first();
  const catName = (await first.locator('span.min-w-0').innerText()).trim();

  /* ── 2. create, kept for later ────────────────────────────────────── */
  await first.click();
  assert.equal(await first.getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: /^Next · 1 chosen$/ }).click();
  await page.getByLabel(`Budget for ${catName}`).fill('5000');
  await page.getByLabel('Name this budget').fill(NAME);
  const current = page.getByRole('checkbox', { name: /Make this my current budget/ });
  await current.uncheck();
  /* Refused first (the last month before the first), then put right and sent again. The box was unticked and
     must still be: a refusal used to let React's form reset tick it again, and the resubmit adopted the budget. */
  const monthBefore = await sql`select category_id, amount from budget where household_id = ${hh} and month = ${MONTH}::date order by category_id`;
  const from = await page.getByLabel('From').inputValue();
  const [fy, fm] = from.split('-').map(Number);
  const prior = `${fm === 1 ? fy - 1 : fy}-${String(fm === 1 ? 12 : fm - 1).padStart(2, '0')}`;
  await page.getByLabel('Until').fill(prior);
  await page.getByRole('button', { name: 'Create the budget' }).click();
  await page.getByRole('alert').filter({ hasText: 'The last month comes before the first.' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(300);
  assert.equal(await current.isChecked(), false, 'after a refusal the box is still unticked');
  assert.equal(await page.getByLabel('Name this budget').inputValue(), NAME, 'after a refusal the name is kept');
  ok('a refused create keeps what was typed, and the box stays unticked');
  await page.getByLabel('Until').fill(`${fy + 1}-${String(fm).padStart(2, '0')}`);
  await page.getByRole('button', { name: 'Create the budget' }).click();
  const row = page.getByRole('button', { name: new RegExp(NAME) });
  await row.waitFor({ timeout: 20000 });
  assert.equal(await row.getByText('In use').count(), 0, 'kept for later, not in use');
  const [made] = await sql`select current_at from budget_set where household_id = ${hh} and name = ${NAME}`;
  assert.equal(made.current_at, null, 'the set is not current in the database');
  const monthAfter = await sql`select category_id, amount from budget where household_id = ${hh} and month = ${MONTH}::date order by category_id`;
  assert.deepEqual(monthAfter, monthBefore, "this month's figures did not change");
  ok("put right and sent again, it is kept for later: not in use, and this month's figures are as they were");

  /* ── 3. make it current ───────────────────────────────────────────── */
  await row.click();
  await page.getByRole('button', { name: 'Make current' }).click();
  await page.getByRole('button', { name: new RegExp(`${NAME}.*In use`) }).waitFor({ timeout: 20000 });
  const bar = page.getByRole('region', { name: 'By category' }).getByRole('img', { name: new RegExp(`^${catName}: `) });
  await bar.waitFor();
  const before = await bar.getAttribute('aria-label');
  assert.match(before, /of ₹5,000/);
  await page.getByRole('region', { name: `${monthLong} against the budget` }).waitFor();
  ok(`made current from its open row: "In use", the month's figures, and the bar "${before}"`);

  /* ── 4. adjust this month only ────────────────────────────────────── */
  await page.getByText(`Adjust ${monthLong} only`).click();
  const spent = Number((await sql`select coalesce(sum(s.amount), 0)::text as v from spend_txn s
    join category c on c.id = s.category_id
    where s.household_id = ${hh} and (c.name = ${catName} or c.parent_id = (select id from category where household_id = ${hh} and name = ${catName}))
      and s.occurred_on >= ${MONTH}::date and s.occurred_on < (${MONTH}::date + interval '1 month')`)[0].v);
  /* Half of what has gone, so the line is over budget once saved (or ₹1 when nothing has). */
  const figure = spent > 200 ? Math.floor(spent / 200) : 1;
  const box = page.getByLabel(`${catName} for this month`);
  /* Typed key by key, the month total and the row's figure follow — as static text: nothing rolls during entry. */
  await box.fill('');
  await box.pressSequentially(String(figure), { delay: 30 });
  const form = box.locator('xpath=ancestor::form');
  assert.equal(await form.locator('number-flow-react').count(), 0, 'no rolling Figure anywhere in the budget form');
  const total = (await form.locator('[data-month-total]').innerText()).trim();
  assert.match(total, /^₹[\d,]+$/, `the month total is plain text (${total})`);
  ok(`the budget form's month total (${total}) and row figures are static text while typing`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Budget saved.' }).waitFor({ timeout: 20000 });
  await page.waitForFunction(([name, was]) => {
    const el = [...document.querySelectorAll('[role=img]')].find((e) => e.getAttribute('aria-label')?.startsWith(`${name}: `));
    return el && el.getAttribute('aria-label') !== was;
  }, [catName, before]);
  const after = await bar.getAttribute('aria-label');
  assert.match(after, new RegExp(`of ₹${figure.toLocaleString('en-IN')}`));
  if (spent > figure * 100) assert.match(after, /over budget/);
  const [{ amount }] = await sql`select amount::text from budget b join category c on c.id = b.category_id
    where b.household_id = ${hh} and c.name = ${catName} and b.month = ${MONTH}::date`;
  assert.equal(Number(amount), figure * 100);
  ok(`"Adjust ${monthLong} only" saved ${figure}, and the bar changed to "${after}"`);

  /* ── 5. create with "Make this my current budget" ticked ──────────── */
  /* The box ticked used to crash the create (a JS Date bound as current_at): a 500 and the error screen. Now the
     set is current on arrival, wears "In use", and this month's budget rows are exactly its lines. */
  const failures = [];
  const watch = (r) => { if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`); };
  page.on('response', watch);
  await page.getByRole('button', { name: 'Create another budget' }).click();
  const group2 = page.getByRole('group', { name: 'Which categories to budget' });
  const pick = group2.getByRole('button').first();
  const pickName = (await pick.locator('span.min-w-0').innerText()).trim();
  await pick.click();
  await page.getByRole('button', { name: /^Next · 1 chosen$/ }).click();
  await page.getByLabel(`Budget for ${pickName}`).fill('3000');
  await page.getByLabel('Name this budget').fill(NAME2);
  const current2 = page.getByRole('checkbox', { name: /Make this my current budget/ });
  await current2.check();
  assert.equal(await current2.isChecked(), true, 'the box is ticked');
  await page.getByRole('button', { name: 'Create the budget' }).click();
  await page.getByRole('button', { name: new RegExp(`${NAME2}.*In use`) }).waitFor({ timeout: 20000 });
  page.off('response', watch);
  assert.deepEqual(failures, [], 'no 5xx while creating it');
  const [set2] = await sql`select id, current_at from budget_set where household_id = ${hh} and name = ${NAME2}`;
  assert.ok(set2?.current_at, 'current_at is set in the database');
  const others = await sql`select count(*)::int as n from budget_set where household_id = ${hh} and current_at is not null and id <> ${set2.id}`;
  assert.equal(others[0].n, 0, 'it is the only current set');
  const rowsNow = await sql`select category_id, amount::text from budget where household_id = ${hh} and month = ${MONTH}::date order by category_id`;
  const lines = await sql`select category_id, amount::text from budget_line where set_id = ${set2.id} order by category_id`;
  assert.deepEqual(rowsNow, lines, "this month's budget rows are the set's lines");
  ok(`created with the box ticked: no 5xx, "${NAME2}" is current in the database and wears "In use", and ${monthLong}'s rows are its ${lines.length} line(s)`);
} finally {
  if (!KEEP && hh) {
    await sql.begin(async (tx) => {
      /* The run's own sets, by their run-unique names. Then the budget from this month on is put back to the snapshot
         taken before the run, touching only rows that differ from it: a row the run's Make current or Adjust wrote
         where there was none is deleted by its (category, month); a changed amount is set back; a row the run
         cleared is written again. A row the run did not change is left alone. */
      await tx`delete from budget_set where household_id = ${hh} and name in (${NAME}, ${NAME2})`;
      const key = (r) => `${r.category_id}|${new Date(r.month).toISOString().slice(0, 10)}`;
      const before = new Map(saved.map((r) => [key(r), r]));
      const nowRows = await tx`select category_id, month, amount from budget where household_id = ${hh} and month >= ${MONTH}::date`;
      const present = new Set(nowRows.map(key));
      for (const r of nowRows) {
        const was = before.get(key(r));
        if (!was) await tx`delete from budget where household_id = ${hh} and category_id = ${r.category_id} and month = ${r.month}`;
        else if (String(was.amount) !== String(r.amount)) {
          await tx`update budget set amount = ${was.amount} where household_id = ${hh} and category_id = ${r.category_id} and month = ${r.month}`;
        }
      }
      for (const r of saved) {
        if (!present.has(key(r))) {
          await tx`insert into budget (household_id, category_id, month, amount) values (${hh}, ${r.category_id}, ${r.month}, ${r.amount})`;
        }
      }
      for (const c of wasCurrent) {
        await tx`update budget_set set current_at = ${c.current_at} where id = ${c.id} and current_at is distinct from ${c.current_at}`;
      }
    });
  }
  await browser.close();
  await sql.end();
}
console.log(`plan-taps: ${n} passed`);
