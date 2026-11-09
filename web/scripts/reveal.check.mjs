#!/usr/bin/env node
/* The arrival motion, watched (v3.1 P4): content arrives on a navigation or a cold load, and never on a redraw.

     node scripts/reveal.check.mjs [--shots dir] [--state file]

   Env: REVEAL_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local; local databases only
   (local-only.mjs): it locks tables for a moment and saves one ₹7 entry, which it deletes again.

   Three cases, each on an iPhone 13 (393×852) with motion on, every `animationstart` noted in the page:
     1. A cold load of /worth, light and dark, with the server held for 700ms (the tables Wealth reads are locked, as
        frames.check does), so the streamed frame is on screen: its sections arrive in turn (Reveal) once it lands.
     2. A tap on the Activity tab from Home: the day groups arrive in turn.
     3. A Save in the Add drawer over Home: Home comes back under /?saved=… and nothing in it plays its entrance.
   In every case, no element inside a revealed section may be position: fixed (CLAUDE.md, "Content arrives").
   With --shots, each case is also a frame strip (a frame every 50ms from the screencast) in that folder. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localOwnerUrl } from './local-only.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const postgres = require('postgres');
const sharp = require('sharp');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.REVEAL_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const SHOTS = arg('--shots');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const sql = postgres(localOwnerUrl(ROOT), { ssl: 'require', max: 2, onnotice: () => {} });
const EMAIL = process.env.REVEAL_EMAIL || 'ammar@example.com';
const [user] = await sql`select id, active_household_id as hh from app_user where email = ${EMAIL}`;
const started = (await sql`select now() as t`)[0].t;
const LAYOUT = new Set(['app_user', 'member', 'household']);
const tables = (await sql`select tablename from pg_tables where schemaname = 'public' and tablename not like '\\_%'`)
  .map((r) => r.tablename).filter((t) => !LAYOUT.has(t));

/* In the page: every entrance that starts (tw-animate's `enter`) on live content, not on a tap's frame or a drawer. */
function watch() {
  window.__enter = [];
  window.__fixedIn = [];
  addEventListener('animationstart', (e) => {
    if (e.animationName !== 'enter') return;
    const t = e.target;
    if (!(t instanceof Element) || t.closest('[data-pending-frame], [role=dialog], [data-slot=drawer-overlay]') || !t.closest('main')) return;
    window.__enter.push({ t: performance.now(), path: location.pathname + location.search, what: t.getAttribute('aria-label') || t.tagName.toLowerCase() });
    /* The entrance sets a transform and a filter, so a fixed child of a revealed section would be carried off its place. */
    for (const el of t.querySelectorAll('*')) {
      if (getComputedStyle(el).position === 'fixed') window.__fixedIn.push(`${t.getAttribute('aria-label') || t.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    }
  }, true);
}

const { defaultBrowserType, ...iphone } = devices['iPhone 13']; void defaultBrowserType;
const browser = await chromium.launch();
let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };

async function open(theme = 'light') {
  const ctx = await browser.newContext({ ...iphone, viewport: { width: 393, height: 852 }, storageState: STATE, colorScheme: theme, serviceWorkers: 'block' });
  await ctx.addInitScript(watch);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push({ ts: f.metadata.timestamp * 1000, data: f.data });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const film = {
    start: () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 393, maxHeight: 852, everyNthFrame: 1 }),
    stop: () => cdp.send('Page.stopScreencast'),
  };
  return { ctx, page, cdp, frames, film };
}

/* A frame every 50ms from `t0` (epoch ms) for `ms`, side by side in rows of ten, each labelled by its time. */
async function strip(frames, t0, ms, file) {
  if (!SHOTS || !frames.length) return;
  const picks = [];
  for (let t = 0; t <= ms; t += 50) {
    const f = [...frames].reverse().find((x) => x.ts <= t0 + t) ?? frames[0];
    picks.push({ t, f });
  }
  const W = 131, H = 284, per = 10;
  const rows = Math.ceil(picks.length / per);
  const tiles = await Promise.all(picks.map(async ({ t, f }, i) => {
    const img = await sharp(Buffer.from(f.data, 'base64')).resize(W, H).toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="16"><rect width="${W}" height="16" fill="black"/><text x="4" y="12" font-size="11" font-family="sans-serif" fill="white">${t}ms</text></svg>`);
    return [{ input: img, left: (i % per) * W, top: Math.floor(i / per) * (H + 16) + 16 }, { input: label, left: (i % per) * W, top: Math.floor(i / per) * (H + 16) }];
  }));
  await sharp({ create: { width: per * W, height: rows * (H + 16), channels: 3, background: '#888' } })
    .composite(tiles.flat()).png().toFile(path.join(SHOTS, file));
}

const wrote = [];
try {
  /* 1. A cold load of /worth, held 700ms so the streamed frame shows, light and dark. */
  for (const theme of ['light', 'dark']) {
    const { ctx, page, frames, film } = await open(theme);
    await page.goto('about:blank');
    await film.start();
    const conn = await sql.reserve();
    let t0;
    try {
      await conn`begin`;
      await conn`set local lock_timeout = '5s'`;
      await conn.unsafe(`lock table ${tables.map((t) => `"${t}"`).join(', ')} in access exclusive mode`);
      t0 = Date.now();
      const nav = page.goto(`${BASE}/worth`, { waitUntil: 'commit' }).catch(() => {});
      await page.waitForSelector('main[aria-busy=true]', { timeout: 5000 });
      await page.waitForTimeout(700);
      await conn`rollback`;
      await nav;
    } finally { conn.release(); }
    await page.waitForSelector('main:not([aria-busy])', { timeout: 15000 });
    await page.waitForTimeout(900);
    await film.stop();
    const seen = await page.evaluate(() => window.__enter);
    assert.ok(seen.length >= 3, `the Wealth sections arrive in turn on a cold load (${seen.length} entrances)`);
    assert.deepEqual(await page.evaluate(() => window.__fixedIn), [], 'nothing fixed inside a revealed section on Wealth');
    ok(`cold /worth (${theme}): the streamed frame, then ${seen.length} sections arriving in turn, none holding anything fixed`);
    await strip(frames, t0, 1900, `cold-worth-${theme}.png`);
    await ctx.close();
  }

  /* 2. Home → Activity by the tab. */
  {
    const { ctx, page, cdp, frames, film } = await open();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.__enter.length = 0; });
    await film.start();
    await page.waitForTimeout(150);
    const b = await page.locator('nav[aria-label=Main] a[href="/entries"]').boundingBox();
    const t0 = Date.now();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForURL((u) => u.pathname === '/entries', { timeout: 15000 });
    await page.waitForSelector('main:not([aria-busy]) section[aria-label]', { timeout: 15000 });
    await page.waitForTimeout(900);
    await film.stop();
    const seen = await page.evaluate(() => window.__enter.filter((e) => e.path.startsWith('/entries')));
    assert.ok(seen.length >= 1, 'Activity\'s day groups arrive after the tab');
    assert.deepEqual(await page.evaluate(() => window.__fixedIn), [], 'nothing fixed inside a revealed section on Activity');
    ok(`tab Home → Activity: ${seen.length} day group(s) arriving in turn, none holding anything fixed`);
    await strip(frames, t0, 1400, 'tap-home-activity.png');
    await ctx.close();
  }

  /* 3. Save in the Add drawer over Home: Home is drawn again under /?saved=…, and nothing plays its entrance. */
  {
    const { ctx, page, frames, film } = await open();
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('a[href="/add"]').first().click();
    const drawer = page.locator('[data-slot=drawer-content]');
    await drawer.getByLabel(/^Amount in/).waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Amount in'));
    await page.keyboard.type('7');
    await drawer.locator('[data-category-tile]').first().click();
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__enter.length = 0; });
    await film.start();
    await page.waitForTimeout(150);
    const t0 = Date.now();
    await drawer.locator('[data-save]').click();
    await page.getByText('Entry saved.').waitFor({ timeout: 15000 });
    await page.waitForTimeout(1200);
    await film.stop();
    const rows = await sql`select id from txn where household_id = ${user.hh} and created_by = ${user.id}
      and created_at >= ${started} and amount = 700 and kind = 'expense'`;
    wrote.push(...rows.map((r) => r.id));
    assert.equal(rows.length, 1, 'the ₹7 entry landed once');
    const seen = await page.evaluate(() => window.__enter);
    assert.equal(page.url().replace(BASE, '').split('?')[0], '/');
    assert.deepEqual(seen, [], `no entrance replays on Home after the Save (${JSON.stringify(seen)})`);
    ok('Save in the Add drawer: back on Home with "Entry saved.", and no section replayed its entrance');
    await strip(frames, t0, 1600, 'save-add-home.png');
    await ctx.close();
  }
} finally {
  await browser.close();
  if (wrote.length) {
    await sql`delete from claim where txn_id = any(${wrote}::uuid[])`.catch((e) => console.error(e.message));
    await sql`delete from txn where id = any(${wrote}::uuid[])`.catch((e) => console.error(e.message));
    console.log(`  cleaned up ${wrote.length} row(s)`);
  }
  await sql.end();
}
console.log(`\n  reveal.check: ${n} passed${SHOTS ? ` · strips in ${SHOTS}` : ''}\n`);
