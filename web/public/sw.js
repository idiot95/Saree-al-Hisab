/* What this service worker does, and deliberately does not do.

   It does NOT cache pages. Every screen in this app is server-rendered from a
   household's own books, so a cached page is somebody's finances sitting on
   disk waiting to be shown to whoever picks the phone up next — including
   after they have signed out, or on a shared handset. Navigations therefore go
   to the network every time, and fall back to a plain offline page.

   It DOES cache the static assets, which are content-hashed and carry nobody's
   data. That is what makes a return visit open instantly.

   Recording an entry while offline would need a queue on the device and a
   sync when the signal comes back. That is a real feature and this is not it;
   pretending otherwise would lose somebody's dinner receipt. */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([OFFLINE, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
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
