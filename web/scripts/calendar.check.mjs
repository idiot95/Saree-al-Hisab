#!/usr/bin/env node
/* The month grid, loaded on demand (v3.1 P5 fix round 1, review I2 and I3), against a running production build.

     node scripts/calendar.check.mjs [--state file] [--shots dir]

   Env: NAV_BASE (default http://localhost:3000). Read only: nothing is saved.

   1. No signal for the grid: the calendar's chunks (the files carrying react-day-picker, found in .next) are refused.
      With ₹123 typed on Add, When opens its drawer at once, the grid's room says the month needs a signal with
      Try again, the drawer and the amount stay, and the route's error screen never shows. Let through again, Try
      again draws the grid.
   2. The grid late: its chunks held 1.5s, a tap on When before they land shows the month drawn still (the ghost:
      the month's name and its day numbers) at the grid's exact height, and the drawer does not change height when
      the grid replaces it.
   3. A slow phone (Pixel 7, CPU 4×, +150ms a request), as used: Add open for its idle time, then When. The grid is
      there in the drawer's first frame (no ghost, no empty box), and how long the drawer took is reported;
      `--shots dir` writes the frames (about every 50ms) as one strip, when-strip.png. Also the same tap 150ms
      after Add has loaded, before its idle time (the ghost may show; never an empty box): when-early-strip.png. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const sharp = require('sharp');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.NAV_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const STATE = arg('--state', path.join(ROOT, '.sweep-state.json'));
const SHOTS = arg('--shots', null);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const CHUNKS = path.join(ROOT, '.next/static/chunks');
const calendarChunks = fs.readdirSync(CHUNKS).filter((f) => f.endsWith('.js') && fs.readFileSync(path.join(CHUNKS, f), 'utf8').includes('rdp-'));
assert.ok(calendarChunks.length > 0, 'found the calendar chunk in this build');
const isCalendar = (u) => calendarChunks.some((f) => u.pathname.endsWith(`/${f}`));

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;
const browser = await chromium.launch();
const when = (page) => page.getByRole('button', { name: /When/ }).first();
const dialog = (page) => page.getByRole('dialog', { name: 'Which day was it' });

try {
  /* ── 1. refused ── */
  {
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    let refused = 0;
    await page.route(isCalendar, (r) => { refused++; return r.abort('internetdisconnected'); });
    await page.goto('/add', { waitUntil: 'networkidle' });
    const amount = page.getByLabel(/^Amount in/);
    await amount.fill('123');
    await when(page).click();
    await dialog(page).waitFor();
    await page.locator('[data-calendar-failed]').waitFor({ timeout: 10000 });
    assert.ok(refused > 0, 'the chunk was asked for and refused');
    assert.ok(await dialog(page).isVisible(), 'the drawer is still open');
    assert.equal(await amount.inputValue(), '123', 'the amount typed is still there');
    assert.equal(await page.getByText(/didn.t load/i).count(), 0, 'no error screen');
    ok(`no signal: the grid's room says so with Try again (${refused} refused), the drawer and ₹123 stay`);
    await page.unroute(isCalendar);
    await page.getByRole('button', { name: 'Try again' }).click();
    await dialog(page).getByRole('grid').first().waitFor({ timeout: 10000 });
    ok('signal back: Try again draws the grid in the same drawer');
    await ctx.close();
  }
  /* ── 2. late: the ghost, same height ── */
  {
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.route(isCalendar, async (r) => { await new Promise((x) => setTimeout(x, 1500)); await r.continue().catch(() => {}); });
    await page.goto('/add', { waitUntil: 'load' });
    await when(page).click();
    const ghost = page.locator('[data-calendar-ghost]');
    await ghost.waitFor({ timeout: 3000 });
    const g = await ghost.boundingBox();
    const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
    assert.ok((await ghost.innerText()).includes(month), `the ghost names the month (${month})`);
    const dlg0 = await dialog(page).boundingBox();
    await dialog(page).getByRole('grid').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(300);
    const grid = await page.evaluate(() => {
      let el = document.querySelector('[role=dialog] [role=grid]');
      while (el && !String(el.className).includes('[--cell-size')) el = el.parentElement;
      return el ? el.getBoundingClientRect().height : null;
    });
    const dlg1 = await dialog(page).boundingBox();
    assert.ok(Math.abs(g.height - grid) <= 1, `ghost ${g.height}px against grid ${grid}px`);
    assert.ok(Math.abs(dlg0.height - dlg1.height) <= 1, `the drawer kept its height (${dlg0.height} → ${dlg1.height})`);
    ok(`late: the month drawn still (${month}) at the grid's height, ${Math.round(g.height)}px; the drawer did not move`);
    await ctx.close();
  }
  /* ── 3. a slow phone ── */
  for (const [name, wait] of [['when-strip', 'idle'], ['when-early-strip', 150]]) {
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.5e6, uploadThroughput: 0.5e6 });
    await page.addInitScript(() => {
      window.__seen = { ghost: null, grid: null, empty: false };
      const t0 = () => window.__tap ?? Infinity;
      new MutationObserver(() => {
        const t = performance.now() - t0();
        const d = document.querySelector('[role=dialog][aria-label="Which day was it"], [role=dialog]');
        if (!d || t < 0) return;
        if (window.__seen.ghost === null && d.querySelector('[data-calendar-ghost]')) window.__seen.ghost = Math.round(t);
        if (window.__seen.grid === null && d.querySelector('[role=grid]')) window.__seen.grid = Math.round(t);
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/add', { waitUntil: 'load' });
    if (wait === 'idle') await page.waitForLoadState('networkidle'); else await page.waitForTimeout(wait);
    const box = await when(page).boundingBox();
    const frames = [];
    await page.evaluate(() => { window.__tap = performance.now(); });
    const p = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const start = Date.now();
    while (Date.now() - start < 1100) {
      frames.push({ t: Date.now() - start, buf: await page.screenshot({ scale: 'css' }) });
      await page.waitForTimeout(30);
    }
    await dialog(page).getByRole('grid').first().waitFor({ timeout: 10000 });
    const seen = await page.evaluate(() => window.__seen);
    if (wait === 'idle') {
      assert.equal(seen.ghost, null, `after Add's idle time no ghost is needed (ghost at ${seen.ghost}ms)`);
    }
    ok(`slow phone, ${wait === 'idle' ? 'after idle' : 'tapped 150ms after load'}: grid in the drawer at ${seen.grid}ms after the tap`
      + (seen.ghost !== null ? `, the still month from ${seen.ghost}ms until then` : ', no ghost needed'));
    if (SHOTS) {
      const keep = frames.filter((f, i) => i === 0 || f.t - frames[i - 1].t >= 40).slice(0, 14);
      const W = 206, H = 458;
      const tiles = await Promise.all(keep.map(async (f) => sharp(f.buf).resize(W, H).toBuffer()));
      const strip = sharp({ create: { width: W * tiles.length, height: H + 22, channels: 3, background: '#ffffff' } })
        .composite([
          ...tiles.map((b, i) => ({ input: b, left: i * W, top: 22 })),
          ...keep.map((f, i) => ({ input: Buffer.from(`<svg width="${W}" height="22"><text x="6" y="16" font-size="14" font-family="sans-serif">+${f.t}ms</text></svg>`), left: i * W, top: 0 })),
        ]);
      await strip.png().toFile(path.join(SHOTS, `${name}.png`));
    }
    await ctx.close();
  }
  console.log(`calendar.check: ${n} passed`);
} catch (e) {
  console.error(`  FAIL ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
