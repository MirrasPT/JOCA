// JOCA service worker — minimal + safe.
// Strategy:
//   • navigations (document): network-first, cache fallback (offline shell);
//   • same-origin static assets (script/style/font/image + hashed /assets/*): cache-first;
//   • EVERYTHING ELSE passes straight through — never intercept /ws, /auth, non-GET requests,
//     or any known API path (terminal I/O, inbox, tasks… must always hit the server live).
const CACHE_VERSION = 'joca-v3-1';
const CACHE_NAME = `joca-static-${CACHE_VERSION}`;

// Prefixes that must NEVER be served from cache (mirror of the backend API surface).
const API_PREFIXES = [
  '/ws', '/auth', '/notifications', '/runs', '/heartbeat', '/cli-profiles', '/cli-tools',
  '/automations', '/tasks', '/projects', '/project-memory', '/runtime', '/joca-items',
  '/joca-logic', '/toolkit-item', '/files', '/file-content', '/file-op', '/file-diff',
  '/upload', '/open', '/optimize-objective', '/roots', '/ui-settings', '/rate-limits',
  '/llm-providers', '/knowledge-graph',
];

const STATIC_DESTINATIONS = new Set(['script', 'style', 'font', 'image']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icon.svg']))
      .catch(() => { /* pre-cache é best-effort */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // mutations always go to the network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cross-origin (fonts CDN…) untouched
  if (API_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) return;

  // Navigations: network-first with cached shell fallback (offline).
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error()))
    );
    return;
  }

  // Static same-origin assets: cache-first (Vite hashes filenames, so stale entries are impossible;
  // old hashes are dropped when CACHE_VERSION rotates).
  if (STATIC_DESTINATIONS.has(req.destination) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
  // Anything else: default browser behaviour (no respondWith).
});
