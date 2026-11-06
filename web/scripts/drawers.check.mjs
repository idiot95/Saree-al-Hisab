#!/usr/bin/env node
/* Every drawer is the app's drawer: a Close button, the 86dvh cap, the keyboard where it should be, and focus back on
   whatever opened it. Wealth's drawers were hand-made on vaul until Task 30 (80vh, no Close, focus lost when a field
   took it with autoFocus); the Add drawer and its pickers are proved in add-taps.

     node scripts/drawers.check.mjs [--state file]

   Env: DRAWERS_BASE (default http://localhost:3000). --state is a signed-in Playwright storage state for an owner or
   contributing member (default .sweep-state.json). Opens and shuts drawers only; nothing is saved. */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.DRAWERS_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const i = argv.indexOf('--state');
const STATE = i >= 0 ? argv[i + 1] : path.join(ROOT, '.sweep-state.json');

const { defaultBrowserType, ...ios } = devices['iPhone 13']; void defaultBrowserType;
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...ios, storageState: STATE })).newPage();
let n = 0;

async function check(url, opener, title, field) {
  await page.goto(BASE + url);
  const btn = page.getByRole('button', { name: opener });
  await btn.click();
  const d = page.getByRole('dialog', { name: title });
  await d.getByRole('button', { name: 'Close', exact: true }).waitFor();
  const { cap, vh } = await d.evaluate((el) => ({ cap: parseFloat(getComputedStyle(el).maxHeight), vh: innerHeight }));
  assert.ok(Math.abs(cap - vh * 0.86) <= 1, `${title}: capped at 86dvh (${cap}px of ${vh}px)`);
  if (field) await page.waitForFunction((f) => document.activeElement?.closest('label')?.textContent?.includes(f), field, { timeout: 5000 });
  await d.getByRole('button', { name: 'Close', exact: true }).click();
  await d.waitFor({ state: 'detached' });
  assert.ok(await btn.evaluate((el) => el === document.activeElement), `${title}: focus back on the button that opened it`);
  n++;
  console.log(`  ok   ${title}: Close, 86dvh${field ? `, "${field}" focused` : ''}, and focus back on the opener`);
}

try {
  await check('/worth', 'Add a pot, gold or silver', 'Add to Wealth');
  await page.goto(`${BASE}/worth`);
  const holding = await page.locator('a[href^="/worth/"]').first().getAttribute('href');
  assert.ok(holding, 'a holding to open');
  await check(holding, /^Update balance$/, 'Update balance', 'today');
  await check(holding, /^Add photos$/, 'Add photos');
  await check(holding, /Tap to override|Tap to set one/, /^Your rate for/, 'for 1');
} finally {
  await browser.close();
}
console.log(`drawers.check: ${n} passed`);
