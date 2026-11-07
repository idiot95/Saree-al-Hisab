#!/usr/bin/env node
/* The loading frames against the screens they stand in for: does the swap move anything?

     node scripts/frames.check.mjs [--routes /,/people] [--shots dir] [--size 393x852[,375x667…]]
                                  [--os ios|android|all] [--theme light|dark|all] [--state file]

   By default every route is measured at the three phone sizes the sweep covers first: 360×780, 375×667 and
   393×852 (v3.1 P4; it was held at 393 only), on iOS in light. `--os all --theme all` adds Android and dark: twelve
   passes. Comma lists work for all three.

   Env: FRAMES_BASE (default http://localhost:3000). Reads OWNER_DATABASE_URL from .env.local. --state is a
   signed-in Playwright storage state (default .sweep-state.json). It refuses any database host but localhost or
   127.0.0.1: it locks tables.

   How the frame is caught: the server is made to wait. Every table a page reads, except the three the layout
   needs to know who is asking (app_user, member, household), is locked ACCESS EXCLUSIVE in an open transaction,
   so the request streams the layout and the route's loading.tsx and then blocks on its first query. The frame is
   measured, the transaction is rolled back, the page streams in, and the same things are measured again.

   What is measured, at the top of the screen where the eye is when the page lands:
     · the title (h1) top;
     · the first card under the header — the hero (its top and height): the first element below the header with
       a rounded card ground (bg-card / bg-hero / bg-attention-soft), at least 40px tall;
     · the first section heading's top — the first h2 below the header, or a frame's [data-frame=label] bar.
   A hero that runs past the fold on both frame and page has only its top compared (its height is the fold's), and
   the line says "hero height not compared, ran past fold". A delta over 4px fails the route.

   A pushed screen whose title is a name (a person, a tab, an account, a holding) draws a ghost of one line: the
   frame cannot know the name. When the name takes more lines on the page than the ghost did, everything under the
   title is measured from the title's foot, not the top of the screen, and the line says so ("name N lines"): the
   frame is answerable for what it can know. The title's top is still compared as it is.
   `[data-frame=skip-hero]` / `skip-label` on the frame's main marks a screen
   whose real page has no such thing at all (it is reported, not compared).

   With --routes, a route may name a link to follow instead of an address: `@/people>^/tab/` opens /people and
   takes the first link whose href matches ^/tab/. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localOwnerUrl } from './local-only.mjs';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const postgres = require('postgres');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.FRAMES_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const STATE = arg('--state') ?? path.join(ROOT, '.sweep-state.json');
const SHOTS = arg('--shots');
const list = (v, all) => (v === 'all' ? all : v.split(',').map((x) => x.trim()).filter(Boolean));
const SIZES = list(arg('--size') ?? '360x780,375x667,393x852', ['360x780', '375x667', '393x852']).map((x) => x.split('x').map(Number));
const OSES = list(arg('--os') ?? 'ios', ['ios', 'android']);
const THEMES = list(arg('--theme') ?? 'light', ['light', 'dark']);
const EMAIL = process.env.FRAMES_EMAIL || 'ammar@example.com';
const TOLERANCE = 4;

const DEFAULT_ROUTES = [
  '/', '/entries', '/entries?f=review', '/entries?f=upcoming', '/entries?f=sms', '/add',
  '/people', '@/people>^/tab/', '@person', '/worth', '@/worth>^/worth/[0-9a-f]', '/accounts',
  '/accounts/reconcile', '@/accounts/reconcile>^/accounts/[0-9a-f-]+/reconcile', '/budget', '/categories',
  '/household', '/household/capture', '/scan', '@/entries>^/entries/[0-9a-f]', '/guide', '/inbox',
];
const routes = arg('--routes') ? arg('--routes').split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ROUTES;

/* Everything a page reads that the layout does not. The layout's own query (who is asking) reads app_user,
   member and household; locking those would hold the layout too, and nothing would stream. */
const LAYOUT_TABLES = new Set(['app_user', 'member', 'household']);

/* It takes ACCESS EXCLUSIVE locks on nearly every table: a local verification database only, never a shared one.
   The shared guard (local-only.mjs) exits 2 for any other host. */
const url = localOwnerUrl(ROOT);
const sql = postgres(url, { ssl: 'require', max: 2, onnotice: () => {} });
const tables = (await sql`
  select tablename from pg_tables where schemaname = 'public' and tablename not like '\\_%'`)
  .map((r) => r.tablename).filter((t) => !LAYOUT_TABLES.has(t));

const browser = await chromium.launch();
let page, W, H, OS, THEME;

/* Measured in the page: the same three things on the frame and on the screen. */
function measure() {
  const busy = document.querySelector('main [aria-busy=true], main[aria-busy=true]');
  const main = busy ? busy.closest('main') : document.querySelector('main');
  const header = main.querySelector('header');
  const below = header ? header.getBoundingClientRect().bottom - 1 : 0;
  /* Height as far as the screen shows it: a list that runs past the fold is measured to the fold. */
  const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(Math.min(b.bottom, innerHeight) - b.top), full: Math.round(b.height), past: b.bottom > innerHeight }; };
  /* The bar: which slot is lit (text-primary), from the frame's still bar or the page's live one. */
  const bars = [...document.querySelectorAll('nav')].filter((n) => getComputedStyle(n).position === 'fixed' && n.getBoundingClientRect().bottom >= innerHeight - 1);
  const bar = bars.length ? bars[bars.length - 1] : null;
  const lit = bar ? [...bar.children].findIndex((c) => /(^|\s)text-primary(\s|$)/.test(c.className)) : null;
  const h1 = main.querySelector('h1, [data-frame=title]');
  /* Home and Plan draw Left to spend; a month with no budget shows a smaller card in its place. */
  const noBudget = /Set this month’s budget|Nothing budgeted for/.test(main.textContent);
  const cardish = /(^|\s)bg-(card|hero|attention-soft)(\s|$)/;
  const hero = [...main.querySelectorAll('*')].find((e) => {
    if (header && header.contains(e)) return false;
    /* Not inside something fixed over the page (the tab bar, a drawer) — the tap's frame itself (PendingSkeleton's
       [data-pending-frame], fixed over the screen it stands for) is the page being measured, not something on it. */
    const fixedBox = e.closest('[class*="fixed"]:not([data-pending-frame])');
    if (fixedBox && fixedBox !== main) return false;
    const c = typeof e.className === 'string' ? e.className : '';
    if (!cardish.test(c) || !/rounded/.test(c) || /rounded-full/.test(c)) return false;
    const b = e.getBoundingClientRect();
    return b.height >= 40 && b.top >= below;
  });
  const label = [...main.querySelectorAll('h2, [data-frame=label]')]
    .find((e) => !(header && header.contains(e)) && e.getBoundingClientRect().height > 0);
  return {
    ghostTitle: !!(h1 && h1.matches('[data-frame=title]')), vh: innerHeight,
    /* The title's line: the title and whatever sits on it (a menu, a pill), which is what moves what is under it. */
    titleRow: box(h1 && h1.parentElement && getComputedStyle(h1.parentElement).display === 'flex' ? h1.parentElement : h1),
    busy: !!busy,
    skip: main.getAttribute('data-frame') ?? '',
    h1: box(h1), hero: box(hero), label: box(label), lit, noBudget, barH: bar ? Math.round(bar.getBoundingClientRect().height) : null,
  };
}

async function resolveRoute(r) {
  if (r === '@person') {
    const [row] = await sql`
      select c.id from counterparty c join member m on m.household_id = c.household_id
      join app_user u on u.id = m.user_id where u.email = ${EMAIL} order by c.name limit 1`;
    if (!row) throw new Error('no person in the books');
    return `/people/${row.id}`;
  }
  if (!r.startsWith('@')) return r;
  const [from, re] = r.slice(1).split('>');
  await page.goto(BASE + from);
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
  const hit = hrefs.find((h) => new RegExp(re).test(h));
  if (!hit) throw new Error(`no link matching ${re} on ${from}`);
  return hit.split('#')[0];
}

const BUSY = 'main[aria-busy=true], main [aria-busy=true]';

/** The frame the server streams (loading.tsx), held by locking the page's tables. Null when the page reads none
 *  of them (it never waits, so its loading.tsx never shows on a direct load). */
async function frameByLock(route, shot) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('about:blank');
    const conn = await sql.reserve();
    try {
      await conn`begin`;
      await conn`set local lock_timeout = '5s'`;
      await conn.unsafe(`lock table ${tables.map((t) => `"${t}"`).join(', ')} in access exclusive mode`);
      const nav = page.goto(BASE + route, { waitUntil: 'commit' }).catch(() => {});
      const held = await page.waitForSelector(BUSY, { timeout: 4000 }).then(() => true, () => false);
      let m = null;
      if (held) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(150);
        m = await page.evaluate(measure);
        if (shot) await page.screenshot({ path: shot });
      }
      await conn`rollback`;
      await nav;
      return m;
    } catch (e) {
      try { await conn`rollback`; } catch { /* gone */ }
      if (!/deadlock|lock timeout/.test(e.message)) throw e;
    } finally { conn.release(); }
  }
  throw new Error('could not take the locks');
}

/* Screens that wait on nothing a lock can hold are caught on the client instead: the tap draws PendingSkeleton's
   copy of the same frame (SkeletonFor) while the RSC request for the screen is held at the network. */
const OPENED_FROM = { '/guide': '/', '/scan': '/guide' };
async function frameByHold(route, shot) {
  const from = OPENED_FROM[route];
  if (!from) return null;
  await page.goto(BASE + from);
  await page.waitForLoadState('networkidle').catch(() => {});
  let release;
  const gate = new Promise((r) => { release = r; });
  const match = (u) => u.pathname === route;
  await page.route(match, async (r) => { await gate; await r.continue().catch(() => {}); });
  await page.evaluate((href) => document.querySelector(`a[href="${href}"]`).click(), route);
  await page.waitForSelector(BUSY, { timeout: 4000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const m = await page.evaluate(measure);
  if (shot) await page.screenshot({ path: shot });
  release();
  await page.unroute(match);
  return { ...m, held: 'client' };
}

const rows = [];
let failed = 0;
const passes = [];
for (const [w, h] of SIZES) for (const os of OSES) for (const theme of THEMES) {
  W = w; H = h; OS = os; THEME = theme;
  const { defaultBrowserType, ...dev } = OS === 'ios' ? devices['iPhone 13'] : devices['Pixel 7']; void defaultBrowserType;
  const ctx = await browser.newContext({
    ...dev, viewport: { width: W, height: H }, screen: { width: W, height: H }, storageState: STATE,
    colorScheme: THEME, serviceWorkers: 'block', reducedMotion: 'reduce',
  });
  page = await ctx.newPage();
  const before = failed;
  console.log(`\n# ${W}x${H} ${OS} ${THEME}`);
  const fmt = (b) => (b ? `${b.top}+${b.h}` : '—');
  for (const raw of routes) {
    let route;
    try { route = await resolveRoute(raw); } catch (e) { console.log(`skip ${raw}: ${e.message}`); continue; }
    const base = SHOTS ? path.join(SHOTS, `${OS}-${W}-${THEME}-${slug(raw.startsWith('@') ? route : raw)}`) : null;
    let frame = await frameByLock(route, base && `${base}-frame.png`);
    if (!frame) frame = await frameByHold(route, base && `${base}-frame.png`);
    if (!frame) { failed++; console.log(`FAIL ${route}: no frame could be held`); continue; }
    await page.goto(BASE + route);
    await page.waitForFunction((b) => !document.querySelector(b), BUSY, { timeout: 15000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const real = await page.evaluate(measure);
    if (base) await page.screenshot({ path: `${base}-page.png` });

    const problems = [];
    const cmp = (what, a, b, field) => {
      if (!a && !b) return;
      if (!a || !b) { problems.push(`${what} ${a ? 'only on the frame' : 'missing from the frame'}`); return; }
      const dlt = Math.abs(a[field] - b[field]);
      if (dlt > TOLERANCE) problems.push(`${what} ${field} ${a[field]} vs ${b[field]} (Δ${dlt})`);
    };
    cmp('title', frame.h1, real.h1, 'top');
    /* A name the frame could not know: measure under the title from its foot (see the head of this file). */
    const shift = frame.ghostTitle && frame.titleRow && real.titleRow && real.h1.full !== frame.h1.full ? real.titleRow.full - frame.titleRow.full : 0;
    const lines = shift ? Math.round(real.h1.full / Math.max(1, frame.h1.full)) : 1;
    if (shift) for (const k of ['hero', 'label']) {
      const b = real[k];
      if (!b) continue;
      const top = b.top - shift;
      real[k] = { ...b, top, h: Math.round(Math.min(b.full, real.vh - top)), past: top + b.full > real.vh };
    }
    if (frame.held !== 'client' && (frame.lit !== real.lit || frame.barH !== real.barH)) problems.push(`tab bar lit ${frame.lit}/${real.lit}, height ${frame.barH}/${real.barH}`);
    /* A hero that runs past the fold on both is clipped to the same height by construction: only its top is compared,
       and the line says so. */
    const pastFold = frame.hero?.past && real.hero?.past;
    if (!frame.skip.includes('skip-hero')) { cmp('hero', frame.hero, real.hero, 'top'); if (!pastFold) cmp('hero', frame.hero, real.hero, 'h'); }
    if (!frame.skip.includes('skip-label')) cmp('heading', frame.label, real.label, 'top');
    const dd = (a, b, f) => (a && b ? a[f] - b[f] : null);
    rows.push({ size: `${W}x${H}`, os: OS, theme: THEME, route: raw === route ? route : `${raw} → ${route}`, held: frame.held ?? 'server', frame, real,
      dTitle: dd(frame.h1, real.h1, 'top'), dHero: dd(frame.hero, real.hero, 'top'), dHeroH: dd(frame.hero, real.hero, 'h'),
      dLabel: dd(frame.label, real.label, 'top') });
    const line = `bar ${frame.lit ?? '—'}/${real.lit ?? '—'}  title ${fmt(frame.h1)}/${fmt(real.h1)}  hero ${fmt(frame.hero)}/${fmt(real.hero)}  heading ${fmt(frame.label)}/${fmt(real.label)}`;
    const tag = `${frame.held === 'client' ? ' [tap]' : ''}${frame.skip ? ` (${frame.skip})` : ''}${pastFold ? ' (hero height not compared, ran past fold)' : ''}${shift ? ` (name ${lines} lines on the page, 1 on the frame: measured under it, ${shift > 0 ? '+' : ''}${shift}px)` : ''}`;
    /* The frames for Home and Plan are the budgeted month's (Left to spend), the state a household lives in once it has
       a budget. Measured against a month with none, the hero is a different card by design: reported, not failed.
       (Run with --state for a household that has a budget to compare them; see the Task 29 report.) */
    if (problems.length && real.noBudget && /^\/(budget)?$/.test(route)) {
      const excused = problems.filter((p) => /^(hero|heading) /.test(p));
      const rest = problems.filter((p) => !excused.includes(p));
      if (rest.length === 0) {
        console.log(`note ${route}  ${line}\n     no budget this month, so the page shows the smaller card; the frame is Left to spend's: ${excused.join('; ')}`);
        continue;
      }
      problems.splice(0, problems.length, ...rest, ...excused.map((p) => `(excused, no budget) ${p}`));
    }
    if (problems.length) { failed++; console.log(`FAIL ${route}${tag}  ${line}\n     ${problems.join('; ')}`); }
    else console.log(`ok   ${route}${tag}  ${line}`);
  }
  passes.push(`${W}x${H} ${OS} ${THEME}: ${failed - before} failed`);
  await ctx.close();
}

function slug(r) { return r.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-?[0-9a-f]{8}-[0-9a-f-]{27}/g, '-id').replace(/^-|-$/g, '') || 'home'; }

console.log(`\n${passes.join('\n')}\n${rows.length} measured, ${failed} failed (frame/page, top+height)`);
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify(rows, null, 2));
await browser.close();
await sql.end();
process.exit(failed ? 1 : 0);
