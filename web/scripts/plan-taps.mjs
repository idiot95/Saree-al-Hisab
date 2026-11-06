#!/usr/bin/env node
/* Plan (/budget), the budget and the trends on one screen, against a running build.

     node scripts/plan-taps.mjs [--state file] [--keep]

   Env: PLAN_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local.
   --state is a signed-in Playwright storage state for an owner or contributing member (default .sweep-state.json).

   1. /trends?m=… redirects to /budget?m=…#trends, keeping its params, and Plan has the #trends section.
   2. Create a budget in two steps with "Make this my current budget" unticked; it is kept, not in use.
   3. Make it current from its open row; it wears "In use" and the month's figures appear with its category bar.
   4. Open "Adjust <month> only", save a smaller figure for that category, and the bar on the page changes —
      over budget, with the word.
   The budget set this run made is deleted and this month's and later budget rows are put back as they were,
   unless --keep.                                                                                              */
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
const BASE = (process.env.PLAN_BASE || 'http://localhost:3000').replace(/\/$/, '');
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
const page = await ctx.newPage();

const NAME = `Plan taps ${Date.now().toString(36)}`;
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
  await page.getByRole('button', { name: 'Create the budget' }).click();
  const row = page.getByRole('button', { name: new RegExp(NAME) });
  await row.waitFor({ timeout: 20000 });
  assert.equal(await row.getByText('In use').count(), 0, 'kept for later, not in use');
  ok('a budget is created in two steps with the box unticked, and is kept, not in use');

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
  await page.getByLabel(`${catName} for this month`).fill(String(figure));
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
} finally {
  if (!KEEP && hh) {
    await sql.begin(async (tx) => {
      await tx`delete from budget_set where household_id = ${hh} and name = ${NAME}`;
      await tx`delete from budget where household_id = ${hh} and month >= ${MONTH}::date`;
      for (const c of wasCurrent) await tx`update budget_set set current_at = ${c.current_at} where id = ${c.id}`;
      for (const r of saved) {
        await tx`insert into budget (household_id, category_id, month, amount) values (${hh}, ${r.category_id}, ${r.month}, ${r.amount})`;
      }
    });
  }
  await browser.close();
  await sql.end();
}
console.log(`plan-taps: ${n} passed`);
