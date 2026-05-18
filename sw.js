/* Cozy Mood · service worker
   Caches the app shell so it works fully offline.
   Bump CACHE_VERSION to force users to refetch updated assets.
*/

const CACHE_VERSION = 'cozy-mood-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './cloud.js',
  './config.js',
  './manifest.webmanifest',
  './favicon.ico',
  // moods (12 stickers)
  './assets/moods/happy.png',
  './assets/moods/excited.png',
  './assets/moods/calm.png',
  './assets/moods/sleepy.png',
  './assets/moods/tired.png',
  './assets/moods/sad.png',
  './assets/moods/angry.png',
  './assets/moods/sick.png',
  './assets/moods/love.png',
  './assets/moods/meh.png',
  './assets/moods/anxious.png',
  './assets/moods/great.png',
  // mascot
  './assets/mascot.png',
  // deco
  './assets/deco/flower.png',
  './assets/deco/star.png',
  './assets/deco/heart.png',
  './assets/deco/cloud.png',
  // tabs
  './assets/tabs/calendar.png',
  './assets/tabs/health.png',
  './assets/tabs/todo.png',
  './assets/tabs/journal.png',
  './assets/tabs/stats.png',
  './assets/tabs/archive.png',
  './assets/tabs/settings.png',
  // header
  './assets/header/search.png',
  './assets/header/theme.png',
  './assets/header/dark.png',
  './assets/header/bell.png',
  './assets/header/menu.png',
  // pwa icons
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // cache items individually so one missing file doesn't break install
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch((err) => console.warn('skip', url, err)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for cross-origin (CDNs, Supabase, fonts)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for same-origin app shell
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // optionally cache new same-origin assets fetched at runtime
          if (res && res.ok && req.url.startsWith(self.location.origin)) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
