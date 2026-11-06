#!/usr/bin/env node
/* Device sweep: every route x five phone sizes x two themes.
 *
 *   node scripts/sweep.mjs [--routes /,/add] [--out dir] [--csp]
 *                          [--engine chromium|webkit|all] [--login email:password]
 *                          [--selftest]
 *
 * Env: SWEEP_BASE (default http://localhost:3000), SWEEP_STATE (Playwright
 * storage-state file for a signed-in user; default web/.sweep-state.json).
 *
 * One line per failure:  route viewport theme: reason (selector or text)
 * Exit code is non-zero when anything failed (or, in --selftest, when a check
 * that should fire did not).
 *
 * Each check is a small named function; the in-page ones run inside
 * page.evaluate and return plain {reason, where} records.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SWEEP_BASE || 'http://localhost:3000').replace(/\/$/, '');
const STATE = process.env.SWEEP_STATE || path.join(HERE, '..', '.sweep-state.json');

const DEFAULT_ROUTES = ['/', '/entries', '/budget', '/trends', '/people', '/worth', '/accounts',
  '/add', '/household', '/categories', '/schedules', '/inbox', '/signin', '/terms', '/offline'];
const PUBLIC_ROUTES = new Set(['/signin', '/terms', '/offline']);

const VIEWPORTS = [
  { w: 360, h: 780, os: 'android' },
  { w: 375, h: 667, os: 'ios' },
  { w: 393, h: 852, os: 'ios' },
  { w: 412, h: 915, os: 'android' },
  { w: 430, h: 932, os: 'ios' },
];
const THEMES = ['light', 'dark'];
const PER_KIND_CAP = 10; // lines printed per kind per page; the rest is counted

/* ---------- args ---------- */
function parseArgs(argv) {
  const a = { routes: DEFAULT_ROUTES, out: 'sweep-out', csp: false, engine: 'chromium', login: null, selftest: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--routes') a.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--csp') a.csp = true;
    else if (k === '--engine') a.engine = argv[++i];
    else if (k === '--login') a.login = argv[++i];
    else if (k === '--selftest') a.selftest = true;
    else { console.error(`unknown argument ${k}`); process.exit(2); }
  }
  if (!['chromium', 'webkit', 'all'].includes(a.engine)) { console.error('--engine must be chromium|webkit|all'); process.exit(2); }
  return a;
}

/* ---------- device emulation ---------- */
function deviceFor(vp) {
  const d = vp.os === 'ios' ? devices['iPhone 13'] : devices['Pixel 7'];
  const { defaultBrowserType, ...rest } = d; // eslint-disable-line no-unused-vars
  return { ...rest, viewport: { width: vp.w, height: vp.h }, screen: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 };
}

/* ---------- in-page checks (serialised into the page; no closures) ---------- */

/** 1. The page must not scroll sideways. */
function checkHorizontalOverflow(expectedWidth) {
  const de = document.documentElement;
  const out = [];
  // Compare with the width the phone really has: on a mobile engine innerWidth
  // grows to fit overflowing content, which would hide the very failure.
  const vw = expectedWidth;
  if (de.scrollWidth > vw) {
    // Name the widest offenders so the failure is findable.
    const culprits = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 0.5) culprits.push(el);
    }
    const leaves = culprits.filter((el) => !culprits.some((o) => o !== el && el.contains(o)));
    const names = leaves.slice(0, 3).map((el) => {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      return `${el.tagName.toLowerCase()}${cls}`;
    }).join(', ');
    out.push({ reason: `horizontal overflow: scrollWidth ${de.scrollWidth} > viewport ${vw}`, where: names || 'html' });
  }
  return out;
}

/** Shared helpers are inlined into each check because evaluate serialises one function. */

/** 2. A fixed/sticky bar must not sit on top of text, measured where the page rests. */
function checkFixedOverlap(edge /* 'top' | 'bottom' */, vw, vh) {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${id}${cls}`;
  };
  const textRects = (el) => {
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const r of rg.getClientRects()) if (r.width > 0 && r.height > 0) rects.push(r);
      }
    }
    return rects;
  };
  const all = Array.from(document.body.querySelectorAll('*'));
  const bars = all.filter((el) => {
    const p = getComputedStyle(el).position;
    if (p !== 'fixed' && p !== 'sticky') return false;
    if (!visible(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width * r.height > 0.5 * vw * vh) return false; // backdrops / full-screen sheets
    if (r.bottom <= 0 || r.top >= vh) return false;       // stuck off-screen
    const mid = (r.top + r.bottom) / 2;
    return edge === 'top' ? mid < vh / 2 : mid >= vh / 2;
  });
  const out = [];
  for (const bar of bars) {
    const br = bar.getBoundingClientRect();
    for (const el of all) {
      if (el === bar || bar.contains(el) || el.contains(bar)) continue;
      if (!visible(el)) continue;
      for (const tr of textRects(el)) {
        const ix = Math.min(br.right, tr.right) - Math.max(br.left, tr.left);
        const iy = Math.min(br.bottom, tr.bottom) - Math.max(br.top, tr.top);
        if (ix > 2 && iy > 2) {
          out.push({
            reason: `${edge} ${label(bar)} covers text at rest (${Math.round(iy)}px)`,
            where: `${label(el)} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
          });
          break;
        }
      }
    }
  }
  return out;
}

/** 3. Nothing shows an ellipsis (or a line clamp) that hides text, unless marked data-truncate-ok. */
function checkTruncation() {
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
    const ellipsis = cs.textOverflow === 'ellipsis';
    if (!ellipsis && !clamp) continue;
    if (el.closest('[data-truncate-ok]')) continue;
    const cut = (ellipsis && el.scrollWidth > el.clientWidth + 1) || (clamp && el.scrollHeight > el.clientHeight + 1);
    if (!cut) continue;
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    out.push({
      reason: `text truncated (${clamp ? 'line-clamp' : 'ellipsis'}, ${el.scrollWidth}>${el.clientWidth})`,
      where: `${el.tagName.toLowerCase()}${id}${cls} "${(el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`,
    });
  }
  return out;
}

/** 4. Tap targets are at least 44x44 (48 for icon-only buttons on Android). */
function checkTapTargets() {
  const platform = document.documentElement.getAttribute('data-platform');
  const out = [];
  for (const el of document.body.querySelectorAll('a, button, [role=button], input, select')) {
    if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const iconOnly = (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !(el.textContent || '').replace(/\s+/g, '').replace(/[-]/g, '');
    const min = platform === 'android' && iconOnly ? 48 : 44;
    if (r.width + 0.5 < min || r.height + 0.5 < min) {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
      out.push({
        reason: `tap target ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`,
        where: `${el.tagName.toLowerCase()}${id}${cls} "${text}"`,
      });
    }
  }
  return out;
}

/* ---------- page-level checks (Node side) ---------- */
const run = (page, fn, ...args) => page.evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);

async function checkConsole(consoleErrors) {
  return consoleErrors.map((t) => ({ reason: 'console error', where: t.slice(0, 160) }));
}
async function checkCsp(page) {
  const v = await page.evaluate(() => window.__cspViolations || []);
  return v.map((s) => ({ reason: 'CSP violation', where: s }));
}

/** Run every check on a loaded page. Overlap is judged at rest: top bars at scroll 0, bottom bars after scrolling to the end. */
async function runChecks(page, { consoleErrors, csp, vw, vh }) {
  const found = [];
  const add = (kind, list) => list.forEach((f) => found.push({ kind, ...f }));
  add('overflow', await run(page, checkHorizontalOverflow, vw));
  add('truncation', await run(page, checkTruncation));
  add('tap', await run(page, checkTapTargets));
  await page.evaluate(() => window.scrollTo(0, 0));
  add('overlap', await run(page, checkFixedOverlap, 'top', vw, vh));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  add('overlap', await run(page, checkFixedOverlap, 'bottom', vw, vh));
  await page.evaluate(() => window.scrollTo(0, 0));
  add('console', await checkConsole(consoleErrors));
  if (csp) add('csp', await checkCsp(page));
  return found;
}

function wireCollectors(page) {
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  return consoleErrors;
}
const CSP_INIT = () => {
  window.__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`);
  });
};

/* ---------- output ---------- */
const slug = (route) => (route === '/' ? '_home' : route.replace(/[^a-z0-9]+/gi, '_').replace(/_$/, ''));
const tally = {};
let total = 0;
function report(route, vp, theme, found) {
  const byKind = {};
  for (const f of found) (byKind[f.kind] ||= []).push(f);
  for (const [kind, list] of Object.entries(byKind)) {
    const seen = new Set();
    const uniq = list.filter((f) => { const k = f.reason + f.where; if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.slice(0, PER_KIND_CAP).forEach((f) => console.log(`${route} ${vp} ${theme}: ${f.reason} (${f.where})`));
    if (uniq.length > PER_KIND_CAP) console.log(`${route} ${vp} ${theme}: ${kind}: +${uniq.length - PER_KIND_CAP} more not listed`);
    tally[kind] = (tally[kind] || 0) + uniq.length;
    total += uniq.length;
  }
}

/* ---------- login ---------- */
async function login(spec) {
  const i = spec.indexOf(':');
  const email = spec.slice(0, i), password = spec.slice(i + 1);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...deviceFor(VIEWPORTS[1]), baseURL: BASE });
  const page = await ctx.newPage();
  await page.goto('/signin');
  await page.getByText('Sign in with your password').click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'), { timeout: 20000 });
  await ctx.storageState({ path: STATE });
  await browser.close();
  console.log(`signed in as ${email}; state written to ${STATE}`);
}

/* ---------- engines ---------- */
async function launch(engine) {
  if (engine === 'chromium') return { browser: await chromium.launch(), name: 'chromium', viewports: VIEWPORTS };
  try {
    const browser = await webkit.launch();
    return { browser, name: 'webkit', viewports: VIEWPORTS.filter((v) => v.os === 'ios') };
  } catch {
    console.log('webkit unavailable; running Chromium with iPhone UA emulation for the iOS pass');
    return { browser: await chromium.launch(), name: 'webkit', viewports: VIEWPORTS.filter((v) => v.os === 'ios') };
  }
}

async function sweepEngine(args, engine, hasState) {
  const { browser, name, viewports } = await launch(engine);
  const dir = path.join(args.out, name);
  fs.mkdirSync(dir, { recursive: true });
  for (const vp of viewports) {
    const vpName = `${vp.w}x${vp.h}`;
    for (const theme of THEMES) {
      const ctx = await browser.newContext({
        ...deviceFor(vp),
        baseURL: BASE,
        serviceWorkers: 'block',
        ...(hasState ? { storageState: STATE } : {}),
      });
      const host = new URL(BASE).hostname;
      await ctx.addCookies([{ name: 'ql.theme', value: theme, domain: host, path: '/' }]);
      if (args.csp) await ctx.addInitScript(CSP_INIT);
      for (const route of args.routes) {
        const page = await ctx.newPage();
        const consoleErrors = wireCollectors(page);
        let found = [];
        try {
          await page.goto(route, { waitUntil: 'load', timeout: 30000 });
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(dir, `${vpName}-${theme}${slug(route)}.png`) });
          found = await runChecks(page, { consoleErrors, csp: args.csp, vw: vp.w, vh: vp.h });
          const landed = new URL(page.url()).pathname;
          if (hasState && !PUBLIC_ROUTES.has(route) && landed.startsWith('/signin')) {
            found.push({ kind: 'load', reason: 'redirected to /signin (state file not signed in?)', where: landed });
          }
        } catch (e) {
          found.push({ kind: 'load', reason: 'page failed to load', where: String(e.message).split('\n')[0].slice(0, 160) });
        }
        report(route, vpName, theme, found);
        await page.close();
      }
      await ctx.close();
    }
  }
  await browser.close();
}

/* ---------- selftest: each kind of check must be able to fire ---------- */
async function selftest() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...deviceFor(VIEWPORTS[0]) });
  await ctx.addInitScript(CSP_INIT);
  const page = await ctx.newPage();
  const consoleErrors = wireCollectors(page);
  const html = `<!doctype html><html data-platform="android"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
    <meta http-equiv="Content-Security-Policy" content="script-src 'self'">
    <style>body{margin:0;height:1600px;font:16px sans-serif}
    .bar{position:fixed;left:0;right:0;bottom:0;height:60px;background:#ccc}</style></head><body>
    <p>Intro text</p>
    <div class="bar">Bar</div>
    <div id="wide" style="width:2000px;height:10px;background:red"></div>
    <div id="ell" style="width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">A very long label that cannot fit</div>
    <div id="ok" data-truncate-ok><div style="width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Allowed to be cut off here</div></div>
    <button id="tiny" style="width:20px;height:20px"></button>
    <p id="last" style="position:absolute;top:1560px;margin:0">Last line under the bar</p>
    </body></html>`;
  await page.route('http://selftest.local/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://selftest.local/');
  await page.evaluate(() => {
    console.error('selftest injected error');
    const s = document.createElement('script'); s.textContent = '1'; document.head.appendChild(s); // blocked by the meta CSP
  });
  await page.waitForTimeout(200);
  const found = await runChecks(page, { consoleErrors, csp: true, vw: VIEWPORTS[0].w, vh: VIEWPORTS[0].h });
  await browser.close();
  const kinds = new Set(found.map((f) => f.kind));
  let bad = 0;
  for (const k of ['overflow', 'overlap', 'truncation', 'tap', 'console', 'csp']) {
    const n = found.filter((f) => f.kind === k).length;
    console.log(`selftest ${k}: ${kinds.has(k) ? 'fired' : 'DID NOT FIRE'} (${n})`);
    if (!kinds.has(k)) bad++;
  }
  const allowed = found.some((f) => f.kind === 'truncation' && /Allowed to be cut/.test(f.where));
  console.log(`selftest data-truncate-ok: ${allowed ? 'NOT HONOURED' : 'honoured'}`);
  if (allowed) bad++;
  found.forEach((f) => console.log(`  ${f.kind}: ${f.reason} (${f.where})`));
  process.exit(bad ? 1 : 0);
}

/* ---------- main ---------- */
const args = parseArgs(process.argv.slice(2));
if (args.selftest) await selftest();
if (args.login) await login(args.login);
const hasState = fs.existsSync(STATE);
if (!hasState) console.log(`warning: no SWEEP_STATE file at ${STATE}; signed-in routes will land on /signin (use --login email:password)`);
const engines = args.engine === 'all' ? ['chromium', 'webkit'] : [args.engine];
for (const e of engines) await sweepEngine(args, e, hasState);
const kinds = Object.entries(tally).map(([k, n]) => `${k}=${n}`).join(' ');
console.log(`\nSWEEP SUMMARY: ${total} failure(s)${kinds ? ` [${kinds}]` : ''}`);
process.exit(total ? 1 : 0);
