#!/usr/bin/env node
/* Wealth's rate lines end, whoever refreshed the rates (v3.1 P5 fix round 1, review I1 and M1).

   Wealth renders with the last stored rates and says which are over a day old ("— updating"); once on screen it
   POSTs /api/rates and redraws when any of those is no longer stale. Two cases, each on a fresh Wealth with every
   stored rate made two days old (fetched_at; put back at the end whatever happens):

     1. Refreshed by someone else: the POST is held while the rates are made fresh in the database (another phone,
        the holding page), then let through. The server finds nothing due and refreshes nothing; the screen must
        still redraw: within 5s no line says "updating", and they say "… rate updated".
     2. A provider down: the POST is answered with every base still stale. The lines say "couldn't update", and no
        second POST goes out (the screen asks once per base).

     node scripts/rates.check.mjs [--state file]

   Env: NAV_BASE (default http://localhost:3000). Local databases only (local-only.mjs). No provider is called. */
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
const BASE = (process.env.NAV_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const STATE = arg('--state', path.join(ROOT, '.sweep-state.json'));
const sql = postgres(localOwnerUrl(ROOT), { ssl: 'require', max: 1, onnotice: () => {} });

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;
const browser = await chromium.launch();
const saved = await sql`select base, quote, as_of::text as as_of, source, fetched_at from price_quote`;
const age = () => sql`update price_quote set fetched_at = fetched_at - interval '2 days'`;
const lines = (page, state) => page.locator(`[data-rate-line="${state}"]`);
try {
  /* ── 1. refreshed elsewhere while the POST is held ── */
  await age();
  {
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route('**/api/rates', async (r) => { await held; await r.continue(); });
    await page.goto('/worth', { waitUntil: 'load' });
    await lines(page, 'updating').first().waitFor({ timeout: 10000 });
    const before = await lines(page, 'updating').count();
    // Someone else refreshes them all now.
    for (const r of saved) {
      await sql`update price_quote set fetched_at = now()
        where base = ${r.base} and quote = ${r.quote} and as_of = ${r.as_of}::date and source = ${r.source}`;
    }
    release();
    await page.waitForFunction(() => document.querySelectorAll('[data-rate-line="updating"]').length === 0, null, { timeout: 5000 })
      .catch(() => {});
    const still = await lines(page, 'updating').count();
    const updated = await lines(page, 'updated').count();
    assert.equal(still, 0, `no line still says "updating" 5s after the answer (${still} of ${before})`);
    assert.ok(updated >= 1, `the lines say the rates were updated (${updated})`);
    ok(`refreshed by someone else: all ${before} "updating" lines became "… rate updated", in their room`);
    await ctx.close();
  }
  /* ── 2. a provider down: "couldn't update", asked once ── */
  await age();
  {
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    let posts = 0;
    await page.route('**/api/rates', async (r) => {
      posts++;
      const due = (await sql`select distinct base from price_quote`).map((x) => x.base);
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ refreshed: [], stale: due }) });
    });
    await page.goto('/worth', { waitUntil: 'load' });
    await lines(page, 'failed').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(2500);
    assert.equal(await lines(page, 'updating').count(), 0, 'no line says "updating"');
    assert.equal(posts, 1, `asked once (${posts})`);
    ok(`a provider down: the lines say "couldn't update" (${await lines(page, 'failed').count()}), and the screen asked once`);
    await ctx.close();
  }
  console.log(`rates.check: ${n} passed`);
} catch (e) {
  console.error(`  FAIL ${e.message}`);
  process.exitCode = 1;
} finally {
  for (const r of saved) {
    await sql`update price_quote set fetched_at = ${r.fetched_at}
      where base = ${r.base} and quote = ${r.quote} and as_of = ${r.as_of}::date and source = ${r.source}`;
  }
  console.log(`  ${saved.length} rates put back to when they were fetched`);
  await browser.close();
  await sql.end();
}
