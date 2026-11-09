/* What this service worker does, and deliberately does not do.

   It does NOT cache pages. Every screen in this app is server-rendered from a
   household's own books, so a cached page is somebody's finances sitting on
   disk waiting to be shown to whoever picks the phone up next — including
   after they have signed out, or on a shared handset. Navigations therefore go
   to the network every time, and fall back to the offline page.

   It DOES cache the static assets, which are content-hashed and carry nobody's
   data. That is what makes a return visit open instantly.

   The offline page is the one page it keeps, and it is kept precisely
   because it holds nothing: it is Add Entry with the names filled in from
   the phone's own storage after it opens, and every save it makes goes to a
   queue on the phone that the app sends when signal returns. The page is
   fetched once at install together with every script and stylesheet it
   names, so the whole thing is a self-consistent snapshot: the nonce in its
   cached headers is the nonce in its cached markup, and the chunks it asks
   for are the chunks that were cached beside it. Bump VERSION when the
   offline screen changes, so the snapshot is taken again.

   Idle cost (v3.1 P5, perf row 10). A request the worker handles has to wake it first, which after half a minute
   idle is 25–45ms on a laptop and more on a cheap phone — paid on every tap's RSC fetch, though the handler only
   ever passed those on. So:
     · Where the browser has static routing (InstallEvent.addRoutes, Chromium), only navigations and the cached
       assets (/_next/static, /icons, /brands, the manifest) are routed to this worker; everything else — RSC data,
       Server Actions, /api, attachments — goes straight to the network without waking it. Safari has no addRoutes
       and keeps doing exactly what it did: every request reaches the handler below, which passes the same ones on.
     · Navigation preload: a document load starts its network request while the worker boots, and the handler
       answers with that response. The /offline fallback is unchanged.
   Nothing new is cached: no HTML, no RSC, nothing with a household's data in it.

   With preload on, the browser has already sent a navigation's request by the time the handler runs, so the handler
   must answer every navigation with that response (v44, P5 fix round 1). v43 returned early for /api/* before its
   navigate branch, so Chromium sent the request a second time — and Google's sign-in callback is a navigation to
   /api/auth/callback/google whose code works once: the preload spent it and the person saw the second, refused try.
   Now /api/* goes straight to the network without the worker where static routing exists (the first rule), and
   wherever the handler does see a navigation — /api/* included, which is how Safari, with no addRoutes, sees it —
   it answers with the preloaded response and never asks again. An /api/* navigation gets no /offline stand-in: an
   auth answer is never replaced by a page. */

const VERSION = 'v44';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE = '/offline';

/* Everything the offline page will ask for once it is on screen: the
   scripts and stylesheets it names, whether as tags or as preload hints. */
function assetsNamedIn(html) {
  const found = new Set();
  const re = /<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const u = m[1];
    if (u.startsWith('/_next/static/') || u.startsWith('/icons/')) found.add(u);
  }
  return [...found];
}

/* The assets the fetch handler caches; the static routes and the handler share this one list. */
const CACHED = ['/_next/static/*', '/icons/*', '/brands/*', '/manifest.webmanifest'];

/* Chromium's static routing: navigations and CACHED to this worker, the rest to the network without it. Rules are
   read in order and the first that matches wins. Best effort: a browser that refuses a rule keeps the old path. */
function routeStatically(event) {
  if (typeof event.addRoutes !== 'function' || typeof URLPattern !== 'function') return null;
  const handled = { or: [{ requestMode: 'navigate' }, ...CACHED.map((pathname) => ({ urlPattern: new URLPattern({ pathname }) }))] };
  return Promise.resolve(event.addRoutes([
    // Auth.js, the rates and the purge: never the worker's, so never preloaded and never asked twice.
    { condition: { urlPattern: new URLPattern({ pathname: '/api/*' }) }, source: 'network' },
    { condition: handled, source: 'fetch-event' },
    { condition: { urlPattern: new URLPattern({ pathname: '/*' }) }, source: 'network' },
  ])).catch(() => {});
}

self.addEventListener('install', (event) => {
  const routed = routeStatically(event);
  event.waitUntil((async () => {
    await routed;
    const shell = await caches.open(SHELL);
    // A fresh copy, never one the browser's own cache is holding on to.
    const page = await fetch(OFFLINE, { cache: 'reload', credentials: 'omit' });
    if (!page.ok) throw new Error(`offline page: ${page.status}`);
    const html = await page.clone().text();
    await shell.put(OFFLINE, page);
    // A Set: the page names the icon itself (its <link rel="icon">), and Cache.addAll refuses a list with the same
    // request twice — which failed the whole install, so no phone ever had the offline screen.
    await shell.addAll([...new Set(['/icons/icon-192.png', ...assetsNamedIn(html)])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // A document's request starts while the worker is still waking; the handler answers with it.
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  /* Every navigation first, before any early return: the preload (GET navigations only) has already gone out, and
     its response is the answer. Fetched again only when there was no preload; never a second time after one. */
  if (request.mode === 'navigate' && request.method === 'GET') {
    const api = new URL(request.url).pathname.startsWith('/api/');
    event.respondWith((async () => {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetch(request);
      } catch {
        // The offline screen for a page; for authentication (an /api/* navigation), only the failure itself.
        return api ? Response.error() : ((await caches.match(OFFLINE)) ?? Response.error());
      }
    })());
    return;
  }

  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch authentication, and never cache anything it returns.
  if (url.pathname.startsWith('/api/')) return;

  // Content-hashed assets: safe to keep, and the reason a second visit is fast.
  const cacheable = CACHED.some((p) => (p.endsWith('*') ? url.pathname.startsWith(p.slice(0, -1)) : url.pathname === p));
  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(ASSETS).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => Response.error())),
  );
});
