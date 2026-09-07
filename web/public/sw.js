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
   offline screen changes, so the snapshot is taken again. */

const VERSION = 'v2';
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

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    // A fresh copy, never one the browser's own cache is holding on to.
    const page = await fetch(OFFLINE, { cache: 'reload', credentials: 'omit' });
    if (!page.ok) throw new Error(`offline page: ${page.status}`);
    const html = await page.clone().text();
    await shell.put(OFFLINE, page);
    await shell.addAll(['/icons/icon-192.png', ...assetsNamedIn(html)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never touch authentication, and never cache anything it returns.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE).then((r) => r ?? Response.error())),
    );
    return;
  }

  // Content-hashed assets: safe to keep, and the reason a second visit is fast.
  const cacheable = url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || url.pathname === '/manifest.webmanifest';
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
