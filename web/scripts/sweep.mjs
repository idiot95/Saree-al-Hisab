#!/usr/bin/env node
/* Device sweep: every route x five phone sizes x two themes.
 *
 *   node scripts/sweep.mjs [--routes /,/add] [--out dir] [--csp]
 *                          [--engine chromium|webkit|all] [--login email:password]
 *                          [--selftest] [--signed-in-links]
 *
 * A route may carry taps to make before it is measured, so a drawer or a fold can be swept open:
 *   /add|tap=^When   — load /add, tap the first button whose accessible name matches /^When/, then measure.
 * Several |tap= steps run in order (no commas in them: --routes splits on commas).
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

const DEFAULT_ROUTES = ['/', '/entries', '/budget', '/people', '/worth', '/accounts',
  '/add', '/household', '/categories', '/entries?f=review', '/entries?f=upcoming', '/entries?f=sms', '/signin', '/signup', '/terms', '/offline'];
/* Public routes are measured with NO session: with one, /signin bounces to /. */
const PUBLIC_ROUTES = new Set(['/signin', '/signup', '/terms', '/offline']);
/* A link's own page is opened by someone not signed in yet: /join/<token> and /reset/<token> too, by default.
   Their signed-in states (the right account, the wrong one, someone already in a household) are real screens as
   well; --signed-in-links measures /join and /reset with the session instead, so those can be swept on purpose. */
let SIGNED_IN_LINKS = false;
const isPublic = (route) => PUBLIC_ROUTES.has(route) || (!SIGNED_IN_LINKS && /^\/(join|reset)\//.test(route));

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
  const a = { routes: DEFAULT_ROUTES, out: 'sweep-out', csp: false, engine: 'chromium', login: null, selftest: false, note: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--routes') a.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--csp') a.csp = true;
    else if (k === '--engine') a.engine = argv[++i];
    else if (k === '--login') a.login = argv[++i];
    else if (k === '--selftest') a.selftest = true;
    else if (k === '--note') a.note = argv[++i];
    else if (k === '--signed-in-links') a.signedInLinks = true;
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
    /* A shut <details> keeps its content laid out (Chromium hides it with content-visibility), so its rects are
       real numbers for text nobody can see. Only the summary is on screen. */
    const shut = el.closest('details:not([open])');
    if (shut && !el.closest('summary')) return false;
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
  /* With a modal dialog open (a drawer swept open with |tap=), the screen is the topmost dialog: what lies behind
     it is covered by design, and a bar outside it only covers its text where the bar really paints on top (the tab
     bar sits under a drawer, so measuring rectangles alone would report every row the drawer is drawn over). */
  const modal = Array.from(document.querySelectorAll('[role=dialog][data-state=open]')).pop() ?? null;
  const out = [];
  for (const bar of bars) {
    const br = bar.getBoundingClientRect();
    for (const el of all) {
      if (el === bar || bar.contains(el) || el.contains(bar)) continue;
      if (modal && !modal.contains(el)) continue;
      if (!visible(el)) continue;
      for (const tr of textRects(el)) {
        const ix = Math.min(br.right, tr.right) - Math.max(br.left, tr.left);
        const iy = Math.min(br.bottom, tr.bottom) - Math.max(br.top, tr.top);
        if (ix > 2 && iy > 2 && modal && !modal.contains(bar)) {
          const hit = document.elementFromPoint((Math.max(br.left, tr.left) + Math.min(br.right, tr.right)) / 2,
            (Math.max(br.top, tr.top) + Math.min(br.bottom, tr.bottom)) / 2);
          if (hit && modal.contains(hit)) continue;
        }
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

/** 4. Tap targets are at least 44x44 (48 for icon-only buttons on Android).
 *  Exempt, in the WCAG 2.5.8 spirit: links inline in running text, sr-only or
 *  clipped boxes, off-screen elements, aria-hidden/inert subtrees, disabled
 *  controls, closed dialogs/drawers, and data-tap-ok="<reason>" (a reason is
 *  required). The box measured is the larger of the element and its nearest
 *  clickable ancestor. */
function checkTapTargets(vw) {
  const platform = document.documentElement.getAttribute('data-platform');
  const out = [];
  const label = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const text = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.getAttribute('href') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls} "${text}"`;
  };
  const inlineInRunningText = (el) => {
    if (el.tagName !== 'A' || getComputedStyle(el).display !== 'inline') return false;
    let host = el.parentElement;
    while (host && getComputedStyle(host).display === 'inline') host = host.parentElement;
    if (!host) return false;
    return Array.from(host.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim()) ||
      Array.from(host.querySelectorAll('*')).some((e) => e !== el && !el.contains(e) && !e.contains(el) &&
        getComputedStyle(e).display === 'inline' && !e.matches('a, button, [role=button]') &&
        Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim()));
  };
  for (const el of document.body.querySelectorAll('a, button, [role=button], input, select')) {
    if (el.tagName === 'INPUT' && el.type === 'hidden') continue;
    if (el.hasAttribute('data-tap-ok')) {
      if (!el.getAttribute('data-tap-ok').trim()) out.push({ reason: 'data-tap-ok needs a reason', where: label(el) });
      continue;
    }
    if (el.disabled) continue;
    if (el.closest('[aria-hidden="true"], [inert]')) continue;
    if (el.closest('dialog:not([open]), [role=dialog][hidden], [data-state=closed]')) continue;
    const det = el.closest('details:not([open])');
    if (det && !el.closest('summary')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
    let r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const clipped = /rect\(\s*0(px)?,\s*0(px)?,\s*0(px)?,\s*0(px)?\)/.test(cs.clip) || /^inset\((50|100)%/.test(cs.clipPath) ||
      (r.width <= 1 && r.height <= 1) || (r.width <= 1 && cs.overflow === 'hidden') ;
    if (clipped) continue;
    if (r.right <= 0 || r.left >= vw || r.bottom + window.scrollY <= 0) continue;
    if (inlineInRunningText(el)) continue;
    const anc = el.parentElement && el.parentElement.closest('a, button, [role=button], label');
    if (anc) {
      const ar = anc.getBoundingClientRect();
      if (ar.width * ar.height > r.width * r.height) r = ar;
    }
    const iconOnly = (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !(el.textContent || '').replace(/\s+/g, '').replace(/[-]/g, '');
    const min = platform === 'android' && iconOnly ? 48 : 44;
    if (r.width + 0.5 < min || r.height + 0.5 < min) {
      out.push({ reason: `tap target ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`, where: label(el) });
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
  add('tap', await run(page, checkTapTargets, vw));
  await page.evaluate(() => window.scrollTo(0, 0));
  add('overlap', await run(page, checkFixedOverlap, 'top', vw, vh));
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await scrollSettled(page);
  add('overlap', await run(page, checkFixedOverlap, 'bottom', vw, vh));
  await page.evaluate(() => window.scrollTo(0, 0));
  add('console', await checkConsole(consoleErrors));
  if (csp) add('csp', await checkCsp(page));
  return found;
}

/** Test-only: no transitions or animations, so measurement never catches a frame mid-motion. */
const NO_MOTION = '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important}';

/** Wait until the page has stopped changing: fonts loaded, nothing aria-busy or
 *  skeletal, animations finished (endless ones ignored), and two layout samples
 *  100ms apart identical. Gives up after `timeout` and measures anyway. */
async function settle(page, timeout = 8000) {
  await page.addStyleTag({ content: NO_MOTION });
  return page.evaluate(async (timeout) => {
    await document.fonts.ready;
    const sample = () => {
      const bars = [];
      for (const el of document.body.querySelectorAll('*')) {
        const p = getComputedStyle(el).position;
        if (p === 'fixed' || p === 'sticky') { const r = el.getBoundingClientRect(); bars.push([r.x, r.y, r.width, r.height].map(Math.round).join(',')); }
      }
      return `${document.body.scrollHeight}|${document.documentElement.scrollWidth}|${bars.join(';')}`;
    };
    const quiet = () =>
      !document.querySelector('[aria-busy="true"], [data-pending]') &&
      document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity);
    const t0 = Date.now();
    let prev = null;
    while (Date.now() - t0 < timeout) {
      const cur = sample();
      if (quiet() && cur === prev) return true;
      prev = cur;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }, timeout);
}

/** After a scroll, wait for two equal scrollY samples. */
async function scrollSettled(page, timeout = 3000) {
  await page.evaluate(async (timeout) => {
    const t0 = Date.now();
    let prev = -1;
    while (Date.now() - t0 < timeout) {
      const y = window.scrollY;
      if (y === prev) return;
      prev = y;
      await new Promise((r) => setTimeout(r, 60));
    }
  }, timeout);
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
  const host = new URL(BASE).hostname;
  const norm = (p) => (p.length > 1 ? p.replace(/\/$/, '') : p);
  for (const vp of viewports) {
    const vpName = `${vp.w}x${vp.h}`;
    for (const theme of THEMES) {
      const open = async (signedIn) => {
        const ctx = await browser.newContext({
          ...deviceFor(vp), baseURL: BASE, serviceWorkers: 'block',
          ...(signedIn ? { storageState: STATE } : {}),
        });
        await ctx.addCookies([{ name: 'ql.theme', value: theme, domain: host, path: '/' }]);
        if (args.csp) await ctx.addInitScript(CSP_INIT);
        return ctx;
      };
      const ctxs = { anon: await open(false), authed: hasState ? await open(true) : null };
      for (const route of args.routes) {
        const ctx = isPublic(route) ? ctxs.anon : ctxs.authed;
        const page = await ctx.newPage();
        const consoleErrors = wireCollectors(page);
        let found = [];
        const [address, ...steps] = route.split('|');
        try {
          await page.goto(address, { waitUntil: 'load', timeout: 30000 });
          const landed = norm(new URL(page.url()).pathname);
          // A route may carry a query (/?saved=…); the pathname is what must match.
          if (landed !== norm(new URL(address, BASE).pathname)) {
            found.push({ kind: 'load', reason: `landed on ${landed}, not the requested route`, where: route });
          } else {
            if (!(await settle(page))) found.push({ kind: 'load', reason: 'page did not settle within 8s (measured anyway)', where: route });
            for (const step of steps) {
              const tap = /^tap=(.+)$/.exec(step);
              if (!tap) throw new Error(`unknown route step ${step}`);
              await page.getByRole('button', { name: new RegExp(tap[1]) }).first().click({ timeout: 10000 });
              await page.waitForTimeout(700);
              await settle(page);
            }
            await page.screenshot({ path: path.join(dir, `${vpName}-${theme}${slug(route)}.png`) });
            found.push(...await runChecks(page, { consoleErrors, csp: args.csp, vw: vp.w, vh: vp.h }));
          }
        } catch (e) {
          found.push({ kind: 'load', reason: 'page failed to load', where: String(e.message).split('\n')[0].slice(0, 160) });
        }
        report(route, vpName, theme, found);
        await page.close();
      }
      await ctxs.anon.close();
      if (ctxs.authed) await ctxs.authed.close();
    }
  }
  await browser.close();
}

/* ---------- selftest: each kind of check must fire, and clean pages must not ---------- */
const CSS = `body{margin:0;font:16px sans-serif}
  .bar{position:fixed;left:0;right:0;bottom:0;height:60px;background:#ccc}
  .top{position:fixed;left:0;right:0;top:0;height:50px;background:#ccc}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  .btn{min-width:48px;min-height:48px}`;
const page = (body, extra = '') => `<!doctype html><html data-platform="android"><head>
  <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">${extra}
  <style>${CSS}</style></head><body>${body}</body></html>`;

const SCENARIOS = [
  { name: 'broken page', csp: true, expect: ['overflow', 'overlap', 'truncation', 'tap', 'console', 'csp'],
    meta: `<meta http-equiv="Content-Security-Policy" content="script-src 'self'">`,
    html: `<style>body{height:1600px}</style><p>Intro text</p><div class="bar">Bar</div>
      <div id="wide" style="width:2000px;height:10px;background:red"></div>
      <div id="ell" style="width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">A very long label that cannot fit</div>
      <div data-truncate-ok><div style="width:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Allowed to be cut off here</div></div>
      <button id="tiny" style="width:20px;height:20px"></button>
      <button id="noreason" data-tap-ok="" style="width:20px;height:20px"></button>
      <p style="position:absolute;top:1560px;margin:0">Last line under the bar</p>`,
    after: async (p) => p.evaluate(() => {
      console.error('selftest injected error');
      const s = document.createElement('script'); s.textContent = '1'; document.head.appendChild(s);
    }),
    also: (found) => found.some((f) => /Allowed to be cut/.test(f.where)) ? 'data-truncate-ok NOT honoured' : null },
  { name: 'clean page (every exemption present)', expect: [],
    html: `<div class="top">Header</div><div style="padding:70px 16px 80px;height:1400px">
      <p>Some text with an <a href="#" id="inline">inline link</a> in running text.</p>
      <button class="btn" id="ok">Fine</button>
      <button class="sr">Screen reader only</button>
      <button disabled style="width:10px;height:10px"></button>
      <button data-tap-ok="decorative dismiss, row is the target" style="width:10px;height:10px"></button>
      <div aria-hidden="true"><button style="width:10px;height:10px"></button></div>
      <dialog><button style="width:10px;height:10px">x</button></dialog>
      <button style="position:absolute;left:-500px;width:10px;height:10px"></button>
      <a href="#" style="display:inline-block;padding:14px 20px"><span><button style="width:10px;height:10px;display:inline-block;padding:0">in</button></span></a>
      <p id="last">Last line, clear of the bar</p></div><div class="bar">Bar</div>` },
  { name: 'text under the bottom bar that can scroll clear passes', expect: [],
    html: `<div style="padding:16px 16px 100px;height:1500px"><p>Top</p><p style="position:absolute;top:1490px;margin:0">Ends the page</p></div><div class="bar">Bar</div>` },
  { name: 'text that cannot scroll clear fails', expect: ['overlap'],
    html: `<div style="height:1500px;position:relative"><p style="position:absolute;top:1480px;margin:0">Last line, flush with the end</p></div><div class="bar">Bar</div>` },
  { name: 'an open drawer drawn over the tab bar passes', expect: [],
    html: `<p style="margin:16px">Behind the drawer</p><div class="bar" style="z-index:40">Tab bar</div>
      <div role="dialog" data-state="open" style="position:fixed;left:0;right:0;bottom:0;height:200px;z-index:50;background:#fff">
        <p style="position:absolute;bottom:10px;margin:0 16px">Save, at the drawer's foot</p></div>` },
  { name: 'a bar painted over an open drawer fails', expect: ['overlap'],
    html: `<div role="dialog" data-state="open" style="position:fixed;left:0;right:0;bottom:0;height:200px;z-index:40;background:#fff">
        <p style="position:absolute;bottom:10px;margin:0 16px">Save, at the drawer's foot</p></div>
      <div class="bar" style="z-index:60">Tab bar</div>` },
  { name: 'top bar over text fails', expect: ['overlap'],
    html: `<div class="top">Header</div><p style="margin:0;padding:16px">Starts under the header</p><div style="height:1000px"></div>` },
];

async function selftest() {
  const browser = await chromium.launch();
  const vp = VIEWPORTS[0];
  const kindsAll = ['overflow', 'overlap', 'truncation', 'tap', 'console', 'csp'];
  let bad = 0;
  for (const sc of SCENARIOS) {
    const ctx = await browser.newContext({ ...deviceFor(vp) });
    await ctx.addInitScript(CSP_INIT);
    const pg = await ctx.newPage();
    const errs = wireCollectors(pg);
    const html = page(sc.html, sc.meta || '');
    await pg.route('http://selftest.local/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await pg.goto('http://selftest.local/');
    if (sc.after) await sc.after(pg);
    await settle(pg);
    const found = await runChecks(pg, { consoleErrors: errs, csp: true, vw: vp.w, vh: vp.h });
    await ctx.close();
    const kinds = new Set(found.map((f) => f.kind));
    console.log(`selftest [${sc.name}]`);
    for (const k of kindsAll) {
      const want = sc.expect.includes(k);
      const got = kinds.has(k);
      const okk = want === got;
      if (!okk) bad++;
      if (want || got) console.log(`  ${okk ? 'ok  ' : 'FAIL'} ${k}: ${got ? 'fired' : 'silent'}${want ? ' (expected)' : ' (UNEXPECTED)'} (${found.filter((f) => f.kind === k).length})`);
    }
    if (!sc.expect.length && !found.length) console.log('  ok   no failures (expected)');
    if (sc.also) { const m = sc.also(found); if (m) { bad++; console.log(`  FAIL ${m}`); } else console.log('  ok   data-truncate-ok honoured'); }
    if (sc.name.startsWith('broken')) found.forEach((f) => console.log(`     ${f.kind}: ${f.reason} (${f.where})`));
    else if (found.length && !sc.expect.length) found.forEach((f) => console.log(`     ${f.kind}: ${f.reason} (${f.where})`));
  }
  await browser.close();
  console.log(bad ? `\nselftest FAILED (${bad})` : '\nselftest passed');
  process.exit(bad ? 1 : 0);
}

/* ---------- main ---------- */
const args = parseArgs(process.argv.slice(2));
SIGNED_IN_LINKS = !!args.signedInLinks;
if (args.selftest) await selftest();
if (args.login) await login(args.login);
const hasState = fs.existsSync(STATE);
const needsSession = args.routes.filter((r) => !isPublic(r));
if (!hasState && needsSession.length) {
  console.error(`error: no SWEEP_STATE file at ${STATE}, but these routes need a session: ${needsSession.join(', ')}.`);
  console.error('Sign in first with --login email:password (or point SWEEP_STATE at a storage-state file).');
  process.exit(1);
}
console.log(`# sweep ${new Date().toISOString()} base ${BASE}${args.note ? ` | ${args.note}` : ''}`);
const engines = args.engine === 'all' ? ['chromium', 'webkit'] : [args.engine];
for (const e of engines) await sweepEngine(args, e, hasState);
const kinds = Object.entries(tally).map(([k, n]) => `${k}=${n}`).join(' ');
console.log(`\nSWEEP SUMMARY: ${total} failure(s)${kinds ? ` [${kinds}]` : ''}`);
process.exit(total ? 1 : 0);
