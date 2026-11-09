#!/usr/bin/env node
/* A navigation reaches the server once, with the worker in control (v3.1 P5 fix round 1, review C1).

   Navigation preload sends a document's request while the worker boots; the handler must answer with that response.
   v43 returned early for /api/* before its navigate branch, so Chromium sent such a navigation twice — and Google's
   sign-in callback (/api/auth/callback/google?code=…) carries a code that works once.

     node scripts/sw-preload.check.mjs [--state file] [--sw-from file]

   Env: NAV_BASE (default http://localhost:3000), a running production build. The browser goes through a counting
   proxy (:3102) to it, so every request that reaches the server is counted, preload or not. Read only.

   Two passes:
     · "static routes": the worker as served — Chromium honours addRoutes, so /api/* never reaches the worker;
     · "handler only": the same worker with its addRoutes call switched off by the proxy, which is what Safari runs
       (no addRoutes): every navigation reaches the handler, with preload on.
   In each, with the worker installed and in control, once each:
     /api/auth/providers (a GET navigation into Auth.js), /api/auth/callback/google?code=…&state=… (the callback's
     shape; it is refused, which is fine — it must be asked once), and /budget (a page) — each reaches the server
     exactly once. Then, offline, /budget is answered with the cached /offline and /api/auth/providers with a network
     error, never the offline page. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const TARGET = new URL(process.env.NAV_BASE || 'http://localhost:3000');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const STATE = arg('--state', path.join(ROOT, '.sweep-state.json'));
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;

let staticRoutes = true;
const hits = [];
/* --sw-from file: serve that worker instead of the build's (to show an older one failing; the check then fails). */
const SW_FROM = arg('--sw-from', null);
const proxy = http.createServer((req, res) => {
  if (SW_FROM && req.url === '/sw.js') {
    let body = fs.readFileSync(SW_FROM, 'utf8');
    if (!staticRoutes) body = body.replace("typeof event.addRoutes !== 'function'", 'true');
    res.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-cache' }); res.end(body);
    return;
  }
  hits.push({ path: req.url, preload: req.headers['service-worker-navigation-preload'] ?? '-' });
  // The host the browser asked for is kept, so the app's own redirects stay on the proxy; sw.js comes uncompressed.
  const headers = { ...req.headers, ...(req.url === '/sw.js' ? { 'accept-encoding': 'identity' } : {}) };
  const up = http.request({ host: TARGET.hostname, port: TARGET.port, path: req.url, method: req.method, headers }, (r) => {
    if (req.url === '/sw.js' && !staticRoutes) {
      // What Safari runs: no static routes, so every request reaches the handler.
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => {
        const body = Buffer.from(Buffer.concat(chunks).toString('utf8')
          .replace("typeof event.addRoutes !== 'function'", 'true'));
        const h = { ...r.headers, 'content-length': String(body.length) };
        delete h['content-encoding'];
        res.writeHead(r.statusCode, h); res.end(body);
      });
      return;
    }
    res.writeHead(r.statusCode, r.headers); r.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(up);
});
await new Promise((r) => proxy.listen(PORT, r));

let n = 0;
const ok = (what) => { n++; console.log(`  ok   ${what}`); };
const { defaultBrowserType, ...pixel } = devices['Pixel 7']; void defaultBrowserType;
const browser = await chromium.launch();
const count = (p) => hits.filter((h) => h.path === p);
try {
  for (const pass of ['static routes', 'handler only']) {
    staticRoutes = pass === 'static routes';
    const ctx = await browser.newContext({ ...pixel, storageState: STATE, baseURL: BASE });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'load' });
    // The worker registers 1.2s after load; wait until it controls the page, then reload so it serves this one.
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 20000 });
    await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('shell-')), null, { timeout: 20000 });
    await page.reload({ waitUntil: 'load' });
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), `${pass}: the worker controls the page`);
    const preload = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).navigationPreload?.getState())?.enabled);
    assert.equal(preload, true, `${pass}: navigation preload is on`);

    for (const p of ['/api/auth/providers', '/api/auth/callback/google?code=p5check&state=p5check', '/budget']) {
      const before = count(p).length;
      await page.goto(p, { waitUntil: 'load' }).catch(() => {});
      await page.waitForTimeout(800);
      const got = count(p).slice(before);
      assert.equal(got.length, 1, `${pass}: ${p} reached the server ${got.length} times (${JSON.stringify(got)})`);
      ok(`${pass}: ${p} reached the server once (preload header: ${got[0].preload})`);
    }

    await ctx.setOffline(true);
    await page.goto('/budget').catch(() => {});
    assert.ok(await page.getByText(/No connection/i).first().isVisible({ timeout: 5000 }).catch(() => false),
      `${pass}: offline, /budget is the cached offline screen`);
    const api = await page.goto('/api/auth/providers').then(() => 'answered', (e) => e.message);
    const body = await page.content().catch(() => '');
    assert.ok(api !== 'answered' && !/No connection/i.test(body), `${pass}: offline, /api/auth/providers is a network error, not the offline page (${api.slice(0, 60)})`);
    ok(`${pass}: offline, a page gets /offline and an /api navigation gets only the network error`);
    await ctx.close();
  }
  console.log(`sw-preload.check: ${n} passed`);
} catch (e) {
  console.error(`  FAIL ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  proxy.close();
}
