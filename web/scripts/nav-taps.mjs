#!/usr/bin/env node
/* The tap frame, the dim and the press under real touches (v3.1 P2): the ways they could stick, ghost or lie.

     node scripts/nav-taps.mjs [--state file]

   Env: NAV_BASE (default http://localhost:3000). --state is a signed-in Playwright storage state (default
   .sweep-state.json). It only reads and navigates: nothing is saved.

   1. A navigation replaced by a tap to where the screen already is (the avatar, then the lit Home tab): the frame
      is gone within one leave, and the next tap works.
   2. The same for a same-screen change (To review, then All): the dim is gone, and the next chip works.
   3. A prefetched push at 1× (Home → household): once the screen has landed, the leaving frame is never above half
      opacity for more than about 60ms, and never moves on over the arrived screen.
   4. A scroll that starts on an Activity row never draws the row's press.
   5. A tab lit by a finger that slides off the bar and lifts there is put back, and nothing navigates.
   6. Home with ?saved= in the address, then the Home tab: the dim clears once the address moves. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.NAV_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const STATE = argv.includes('--state') ? argv[argv.indexOf('--state') + 1] : path.join(HERE, '..', '.sweep-state.json');
const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };

async function context(browser, { cpu = 4, lat = 150 } = {}) {
  const ctx = await browser.newContext({ ...pixel, viewport: { width: 412, height: 915 }, storageState: STATE, baseURL: BASE });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  if (lat) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: lat, downloadThroughput: 1.5e6, uploadThroughput: 0.5e6 });
  }
  return { ctx, page, cdp };
}
async function centre(loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function touch(page, cdp, p, hold = 60) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  await page.waitForTimeout(hold);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
/* Every frame from now: the frame overlay (live or leaving, its opacity and translate), the dim, presses, the URL. */
const sample = (page) => page.evaluate(() => {
  window.__s = []; const t0 = performance.now(); window.__t0 = t0;
  const f = () => {
    const fr = document.querySelector('[data-pending-frame]');
    const cs = fr && getComputedStyle(fr);
    window.__s.push({
      t: Math.round(performance.now() - t0), url: location.pathname + location.search,
      frame: fr ? (fr.hasAttribute('data-leaving') ? 'leaving' : 'live') : null,
      op: cs ? parseFloat(cs.opacity) : 0, tr: cs ? cs.translate : null, pe: cs ? cs.pointerEvents : null,
      dim: document.documentElement.hasAttribute('data-pending-same'),
      pressed: document.querySelectorAll('[data-pressed]').length,
      landed: !!document.querySelector('main h1') && ![...document.querySelectorAll('main')].every((m) => m.closest('[data-pending-frame]')),
    });
    if (performance.now() - t0 < 15000) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
});
const samples = (page) => page.evaluate(() => window.__s);

const browser = await chromium.launch();
try {
  /* ── 1. avatar, then the Home tab ───────────────────────────────────── */
  {
    const { ctx, page, cdp } = await context(browser);
    /* /household is held at the network (its prefetch too), so the first navigation is still on its way when the
       second tap supersedes it — the case that matters, whatever the machine's speed. */
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route((u) => u.pathname === '/household', async (r) => { if (r.request().headers().rsc) await gate; await r.continue().catch(() => {}); });
    await page.goto('/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const avatar = await centre(page.locator('a[aria-label="Household and settings"]'));
    const home = await centre(page.locator('nav[aria-label=Main] a[href="/"]'));
    await sample(page);
    await page.evaluate(() => { window.__clicks = []; addEventListener('click', () => window.__clicks.push(performance.now()), true); });
    await touch(page, cdp, avatar);
    await page.waitForTimeout(30);
    await touch(page, cdp, home);
    await page.waitForTimeout(1500);
    const s = await samples(page);
    const { clicks, t0 } = await page.evaluate(() => ({ clicks: window.__clicks, t0: window.__t0 }));
    const second = clicks.at(-1) - t0;                   // the Home tab's click, on the sampler's own clock
    assert.equal(clicks.length, 2, 'both taps clicked');
    /* Superseded at the click: the frame turns to leaving at once, and is out of the tree within one leave (--dur-1
       and a frame or two; a throttled phone's timers are late, so 400ms). */
    const live = s.filter((x) => x.t > second + 50 && x.frame === 'live');
    assert.deepEqual(live, [], 'no live frame after the Home tab was clicked');
    const after = s.filter((x) => x.t > second + 400);
    assert.ok(after.length > 10, 'sampled after the second tap');
    assert.ok(after.every((x) => !x.frame), `no frame 400ms after the Home tab (${JSON.stringify(after.find((x) => x.frame))})`);
    assert.equal(new URL(page.url()).pathname, '/', 'still on Home');
    release();
    await page.waitForTimeout(1000);
    assert.equal(new URL(page.url()).pathname, '/', 'the dropped navigation never lands later');
    await page.unroute((u) => u.pathname === '/household');
    await touch(page, cdp, await centre(page.locator('a[aria-label="Household and settings"]')));
    await page.waitForURL((u) => u.pathname === '/household', { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('[data-pending-frame]'), null, { timeout: 5000 });
    ok('the avatar, then the Home tab: the frame is gone within one leave, and the next tap opens the household');
    await ctx.close();
  }

  /* ── 2. To review, then All ─────────────────────────────────────────── */
  {
    const { ctx, page, cdp } = await context(browser);
    await page.goto('/entries', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const review = await centre(page.locator('main a[href^="/entries?f=review"]').first());
    const all = await centre(page.locator('main a[href="/entries"]').first());
    await sample(page);
    await touch(page, cdp, review);
    await page.waitForTimeout(30);
    await touch(page, cdp, all);
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-pending-same')), false,
      'the dim is gone once the tap back to All superseded To review');
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-pending-same')), false, 'and stays gone');
    await touch(page, cdp, await centre(page.locator('main a[href^="/entries?f=upcoming"]').first()));
    await page.waitForURL((u) => u.searchParams.get('f') === 'upcoming', { timeout: 15000 });
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-pending-same'), null, { timeout: 5000 });
    ok('To review, then All: the dim is gone, and the next chip (Upcoming) lands and clears its own');
    await ctx.close();
  }

  /* ── 3. a prefetched push at 1×: no ghost over the arrived screen ───── */
  {
    let worst = 0, moved = false, runs = 0;
    for (let i = 0; i < 3; i++) {
      const { ctx, page, cdp } = await context(browser, { cpu: 1, lat: 0 });
      await page.goto('/', { waitUntil: 'load' }); await page.waitForTimeout(3000);
      const avatar = await centre(page.locator('a[aria-label="Household and settings"]'));
      await sample(page);
      await touch(page, cdp, avatar);
      await page.waitForURL((u) => u.pathname === '/household', { timeout: 15000 });
      await page.waitForTimeout(800);
      const s = await samples(page);
      const leave = s.findIndex((x) => x.frame === 'leaving');
      if (leave >= 0) {
        runs++;
        const left = s.slice(leave).filter((x) => x.frame === 'leaving');
        assert.ok(left.every((x) => x.pe === 'none'), 'a leaving frame takes no taps');
        const above = left.filter((x) => x.op > 0.5);
        const span = above.length ? above.at(-1).t - s[leave].t : 0;
        worst = Math.max(worst, span);
        if (new Set(left.map((x) => x.tr)).size > 1) moved = true;
      }
      await ctx.close();
    }
    assert.ok(runs > 0, 'the frame was seen leaving at least once');
    assert.ok(!moved, 'a leaving frame never moves on over the arrived screen');
    assert.ok(worst <= 70, `a leaving frame stays above half opacity for at most ~60ms after landing (worst ${worst}ms)`);
    ok(`a prefetched push at 1×: the leaving frame stops where it is, takes no taps, and is under half opacity ${worst}ms after landing (worst of ${runs})`);
  }

  /* ── 4. a scroll that starts on a row ───────────────────────────────── */
  {
    const { ctx, page, cdp } = await context(browser);
    await page.goto('/entries', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const p = await centre(page.locator('main a[href^="/entries/"]').nth(2));
    await sample(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
    for (let i = 1; i <= 15; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y - i * 4 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const s = await samples(page);
    assert.ok(s.every((x) => x.pressed === 0), `no press drawn on a scroll (${JSON.stringify(s.find((x) => x.pressed))})`);
    assert.equal(new URL(page.url()).pathname, '/entries', 'and the scroll opened nothing');
    // A quick tap still draws its press.
    await sample(page);
    await touch(page, cdp, await centre(page.locator('main a[href^="/entries/"]').nth(2)), 20);
    await page.waitForURL((u) => /^\/entries\/[0-9a-f-]+$/.test(u.pathname), { timeout: 15000 });
    assert.ok((await samples(page)).some((x) => x.pressed > 0), 'a 20ms tap still draws its press');
    ok('a scroll that starts on a row never draws its press; a 20ms tap still does');
    await ctx.close();
  }

  /* ── 5. a tab lit, then the finger slides off the bar ───────────────── */
  {
    const { ctx, page, cdp } = await context(browser);
    await page.goto('/', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    const loans = await centre(page.locator('nav[aria-label=Main] a[href="/people"]'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [loans] });
    await page.waitForTimeout(80);
    assert.equal(await page.locator('nav[aria-label=Main] a[href="/people"]').getAttribute('aria-current'), 'page', 'Loans lights as the finger lands');
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: loans.x, y: loans.y - i * 40 }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(800);
    assert.equal(await page.locator('nav[aria-label=Main] a[href="/people"]').getAttribute('aria-current'), null, 'Loans is put back');
    assert.equal(new URL(page.url()).pathname, '/', 'nothing navigated');
    ok('a tab lit by a finger that slides off the bar and lifts there is put back, and Home stays');
    await ctx.close();
  }

  /* ── 6. Home with ?saved=, then the Home tab ────────────────────────── */
  {
    const { ctx, page, cdp } = await context(browser);
    await page.goto('/?saved=00000000-0000-4000-8000-000000000000', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    if (new URL(page.url()).search === '') console.log('  skip ?saved= was tidied off the address before the tap');
    else {
      await touch(page, cdp, await centre(page.locator('nav[aria-label=Main] a[href="/"]')));
      await page.waitForURL((u) => u.search === '', { timeout: 15000 });
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-pending-same'), null, { timeout: 1000 });
      ok('Home with ?saved=, then the Home tab: the dim clears once the address moves off ?saved=');
    }
    await ctx.close();
  }
  console.log(`\n  nav-taps: ${n} passed`);
} catch (e) {
  console.error(`  FAIL ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
