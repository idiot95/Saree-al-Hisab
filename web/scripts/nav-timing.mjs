#!/usr/bin/env node
/* How long a tap takes to answer: every in-app navigation the perf report timed (perf-findings.md §4), on a
   Pixel 7 with the CPU throttled 4× and 150ms added to every request — about what the owner's phone sees in India.

     node scripts/nav-timing.mjs [--lat 150] [--cpu 4] [--reps 3] [--only regex] [--json file] [--state file]
                                 [--report-only]

   Env: NAV_BASE (default http://localhost:3000). --state is a signed-in Playwright storage state (default
   .sweep-state.json, which `node scripts/sweep.mjs --login …` writes). It only reads: nothing is saved.

   For each route, from the moment the finger lifts (the `click`; the finger is held 80ms, as a real tap is):
     · feedback — the first screencast frame after the finger came down, i.e. the first pixel that changed. Taken
       from finger-up, so a press state drawn while the finger is still down counts as 0 (shown as ≤0).
     · content  — the first painted frame once the destination is really there: the address is the target's, no
       pending frame covers it, no shimmer is left outside one, and its <main> has text (for the Add drawer: the
       dialog has stopped moving).
     · blank    — how long the screen showed nothing: no frame, no <main>, or no text outside the tab bar.
     · vt       — view transitions started; rsc — server renders the tap asked for (navigations + prefetches).
   Medians over --reps runs, each in a fresh context.

   Targets (p2-brief ruling 5), checked unless --report-only: feedback ≤ 50ms on every route, Home → profile
   content ≤ 450ms, and no blank frame anywhere. Exit 1 when one is missed. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const BASE = (process.env.NAV_BASE || 'http://localhost:3000').replace(/\/$/, '');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LAT = Number(arg('--lat', 150));
const CPU = Number(arg('--cpu', 4));
const REPS = Number(arg('--reps', 3));
const ONLY = arg('--only') ? new RegExp(arg('--only'), 'i') : null;
const JSON_OUT = arg('--json');
const STATE = arg('--state', path.join(ROOT, '.sweep-state.json'));
const REPORT_ONLY = argv.includes('--report-only');
const DEBUG = argv.includes('--debug');
const HOLD = 80;
const WATCH = 3000; // ms after the tap that the page is sampled

/* In the page, before anything else runs: event times, a sample of what the screen holds on every frame, and the
   view transitions started. */
function instrument() {
  const ev = (window.__nav = { marks: [], samples: [], vt: 0 });
  const now = () => performance.now();
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const overlays = () => [...document.querySelectorAll('[data-pending-frame], body > div[style*="z-index: 39"]')];
  const sample = () => {
    const ovs = overlays();
    const live = ovs.filter((o) => !o.hasAttribute('data-leaving'));
    const inOv = (el) => ovs.some((o) => o.contains(el));
    const mains = [...document.querySelectorAll('main')].filter((m) => !inOv(m) && visible(m));
    const text = mains.map((m) => {
      const c = m.cloneNode(true);
      c.querySelectorAll('nav').forEach((n) => n.remove());
      return c.textContent.replace(/\s+/g, '');
    }).join('');
    const shim = [...document.querySelectorAll('.shim')].some((s) => !inOv(s) && visible(s));
    const dialog = [...document.querySelectorAll('[role=dialog]')].find(visible);
    return {
      t: now(), url: location.pathname + location.search,
      overlay: live.length > 0, overlayAny: ovs.length > 0,
      main: mains.length, text: text.length, shim,
      dim: document.documentElement.hasAttribute('data-pending-same'),
      dialogTop: dialog ? Math.round(dialog.getBoundingClientRect().top) : null,
      dialogForm: dialog ? !!dialog.querySelector('input') : false,
    };
  };
  addEventListener('pointerdown', (e) => {
    ev.marks.push({ n: 'down', t: e.timeStamp });
    const t0 = now();
    const f = () => { ev.samples.push(sample()); if (now() - t0 < 3200) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }, true);
  addEventListener('click', (e) => ev.marks.push({ n: 'up', t: e.timeStamp }), true);
  const svt = Document.prototype.startViewTransition;
  if (svt) Document.prototype.startViewTransition = function (...a) { ev.vt++; return svt.apply(this, a); };
}

const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;

async function setup(browser) {
  const ctx = await browser.newContext({
    ...pixel, viewport: { width: 412, height: 915 }, screen: { width: 412, height: 915 },
    storageState: STATE, baseURL: BASE,
  });
  await ctx.addInitScript(instrument);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  if (LAT) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LAT, downloadThroughput: 1.5e6, uploadThroughput: 0.5e6 });
  }
  const frames = [];
  cdp.on('Page.screencastFrame', (f) => {
    frames.push(f.metadata.timestamp * 1000);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const reqs = [];
  page.on('request', (r) => {
    const h = r.headers();
    if (h.rsc || h['next-router-prefetch'] || /[?&]_rsc=/.test(r.url())) reqs.push({ pf: !!h['next-router-prefetch'], url: r.url().replace(BASE, '') });
  });
  return { ctx, page, cdp, frames, reqs };
}

async function tap(page, cdp, loc) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('target not on screen');
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(HOLD);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

const tabLink = (href) => `nav[aria-label=Main] a[href="${href}"]`;
/* `from` is where the tap starts; a list walks there by tapping (so Back has a trail and the revisit is cached). */
const ROUTES = [
  { name: 'Home → profile (/household)', from: '/', sel: 'a[aria-label="Household and settings"]', to: /^\/household$/, key: 'profile' },
  { name: 'Tab Home → Activity', from: '/', sel: tabLink('/entries'), to: /^\/entries$/ },
  { name: 'Tab Activity → Loans', from: '/entries', sel: tabLink('/people'), to: /^\/people$/ },
  { name: 'Tab Loans → Wealth', from: '/people', sel: tabLink('/worth'), to: /^\/worth$/ },
  { name: 'Tab Wealth → Home', from: '/worth', sel: tabLink('/'), to: /^\/$/ },
  { name: 'Open Add (drawer)', from: '/', sel: tabLink('/add'), to: /^\/add/, dialog: true },
  { name: 'Chip All → To review', from: '/entries', sel: 'main a[href^="/entries?f=review"]', to: /f=review/ },
  { name: 'Chip → Upcoming', from: '/entries', sel: 'main a[href^="/entries?f=upcoming"]', to: /f=upcoming/ },
  { name: 'Month pill (previous)', from: '/entries', sel: 'a[aria-label="Previous month"]', to: /[?&]m=/ },
  { name: 'Back /household → /', from: ['/', '/household'], sel: 'a[aria-label="Back"]', to: /^\/$/ },
  { name: 'Home month card → Plan', from: '/', sel: 'main a[href="/budget"]', to: /^\/budget$/ },
  { name: 'Home net worth → Wealth', from: '/', sel: 'main a[href="/worth"]', to: /^\/worth$/ },
  { name: 'Home owed to you → Loans', from: '/', sel: 'main a[href="/people"]', to: /^\/people$/ },
  { name: 'Activity row → entry (push)', from: '/entries', sel: 'main a[href^="/entries/"]', to: /^\/entries\/[0-9a-f-]+/ },
  { name: 'Wealth → /accounts', from: '/worth', sel: 'main a[href="/accounts"]', to: /^\/accounts$/ },
  { name: 'Tab Home → Activity (revisit <30s)', from: ['/entries', '/'], sel: tabLink('/entries'), to: /^\/entries$/ },
];

const median = (xs) => {
  const v = xs.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v.length % 2 ? v[(v.length - 1) / 2] : Math.round((v[v.length / 2 - 1] + v[v.length / 2]) / 2);
};

async function once(browser, r) {
  const { ctx, page, cdp, frames, reqs } = await setup(browser);
  try {
    const froms = Array.isArray(r.from) ? r.from : [r.from];
    await page.goto(froms[0], { waitUntil: 'load' });
    for (const f of froms.slice(1)) {
      await tap(page, cdp, page.locator(`${tabLink(f)}, main a[href="${f}"]`).first());
      await page.waitForURL((u) => u.pathname === f, { timeout: 15000 });
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__nav.marks.length = 0; window.__nav.samples.length = 0; window.__nav.vt = 0; });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 20, maxWidth: 412, maxHeight: 915, everyNthFrame: 1 });
    await page.waitForTimeout(500);
    frames.length = 0; reqs.length = 0;
    const origin = await page.evaluate(() => performance.timeOrigin);
    await tap(page, cdp, page.locator(r.sel).first());
    await page.waitForTimeout(WATCH);
    await cdp.send('Page.stopScreencast');
    const nav = await page.evaluate(() => window.__nav);
    const down = nav.marks.find((m) => m.n === 'down')?.t;
    const up = nav.marks.find((m) => m.n === 'up')?.t;
    if (down === undefined || up === undefined) throw new Error('the tap did not register');
    const epoch = (t) => origin + t;
    const painted = (t) => { const f = frames.find((x) => x >= epoch(t)); return f === undefined ? null : f - epoch(up); };
    const S = nav.samples.filter((s) => s.t >= down);
    let readyAt = null;
    if (r.dialog) {
      const last = [...S].reverse().find((s) => s.dialogTop !== null);
      const fin = last?.dialogTop;
      const at = S.find((s) => s.dialogTop !== null && s.dialogForm && Math.abs(s.dialogTop - fin) <= 1);
      readyAt = at ? at.t : null;
    } else {
      const at = S.find((s) => r.to.test(s.url) && !s.overlay && !s.dim && s.main > 0 && s.text > 20 && !s.shim);
      readyAt = at ? at.t : null;
    }
    let blank = 0;
    for (let i = 0; i < S.length - 1; i++) {
      const s = S[i];
      if (readyAt !== null && s.t >= readyAt) break;
      if (!s.overlayAny && s.dialogTop === null && (s.main === 0 || s.text < 3)) blank += S[i + 1].t - s.t;
    }
    if (DEBUG) {
      let last = '';
      for (const s of S) {
        const k = `${s.url} ov=${s.overlay ? 1 : s.overlayAny ? 'L' : 0} main=${s.main} text=${s.text} shim=${s.shim ? 1 : 0} dim=${s.dim ? 1 : 0} dlg=${s.dialogTop}`;
        if (k !== last) { console.log(`   ${Math.round(s.t - up)}ms ${k}`); last = k; }
      }
    }
    const firstFrame = frames.find((x) => x > epoch(down) + 1);
    return {
      up: Math.round(up - down),
      feedback: firstFrame === undefined ? null : Math.round(firstFrame - epoch(up)),
      content: readyAt === null ? null : Math.round(painted(readyAt)),
      blank: Math.round(blank),
      vt: nav.vt,
      rsc: reqs.filter((q) => !q.pf).length, pf: reqs.filter((q) => q.pf).length,
    };
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
const rows = [];
console.log(`# nav-timing ${new Date().toISOString()} base ${BASE} · Pixel 7 412×915 · CPU ${CPU}× · +${LAT}ms · ${REPS} reps`);
for (const r of ROUTES) {
  if (ONLY && !ONLY.test(r.name)) continue;
  const runs = [];
  for (let i = 0; i < REPS; i++) {
    try { runs.push(await once(browser, r)); } catch (e) { runs.push({ error: String(e.message || e).slice(0, 120) }); }
  }
  const ok = runs.filter((x) => !x.error);
  const row = {
    name: r.name, key: r.key, runs,
    up: median(ok.map((x) => x.up)), feedback: median(ok.map((x) => x.feedback)), content: median(ok.map((x) => x.content)),
    blank: Math.max(0, ...ok.map((x) => x.blank)), vt: median(ok.map((x) => x.vt)),
    rsc: median(ok.map((x) => x.rsc)), pf: median(ok.map((x) => x.pf)),
    errors: runs.filter((x) => x.error).map((x) => x.error),
  };
  rows.push(row);
  const fb = row.feedback === null ? '—' : row.feedback <= 0 ? '≤0' : row.feedback;
  console.log(`${r.name.padEnd(38)} feedback ${String(fb).padStart(4)}  content ${String(row.content ?? '—').padStart(5)}  blank ${String(row.blank).padStart(4)}  vt ${row.vt}  rsc ${row.rsc}+${row.pf}pf${row.errors.length ? `  errors: ${row.errors.join(' | ')}` : ''}`);
}
await browser.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ at: new Date().toISOString(), lat: LAT, cpu: CPU, reps: REPS, rows }, null, 1));

const misses = [];
for (const r of rows) {
  if (r.errors.length) misses.push(`${r.name}: ${r.errors.length} run(s) failed`);
  if (r.feedback === null || r.feedback > 50) misses.push(`${r.name}: first feedback ${r.feedback}ms (target ≤ 50)`);
  if (r.content === null) misses.push(`${r.name}: content never arrived`);
  if (r.blank > 0) misses.push(`${r.name}: ${r.blank}ms of blank screen (target 0)`);
  if (r.key === 'profile' && r.content !== null && r.content > 450) misses.push(`${r.name}: content ${r.content}ms (target ≤ 450)`);
}
console.log(misses.length ? `\nNAV-TIMING: ${misses.length} target(s) missed\n  ${misses.join('\n  ')}` : '\nNAV-TIMING: every target met');
process.exit(misses.length && !REPORT_ONLY ? 1 : 0);
