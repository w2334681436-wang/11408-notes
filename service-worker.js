const APP_VERSION = '20260809-focus-zoom-v6';
const SW_VERSION = new URL(self.location.href).searchParams.get('v') || APP_VERSION;
const CACHE_PREFIX = '11408-notes-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${SW_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  `./styles/app.css?v=${APP_VERSION}`,
  `./src/app.js?v=${APP_VERSION}`,
  `./src/pwa.js?v=${APP_VERSION}`,
  './vendor/mathjax/tex-svg.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

function absoluteUrl(path) {
  return new URL(path, self.registration.scope).href;
}

async function precacheApp() {
  const cache = await caches.open(CACHE_NAME);
  const requests = PRECACHE_URLS.map((path) => new Request(absoluteUrl(path), { cache: 'reload' }));
  await cache.addAll(requests);
}

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'CHECK_OFFLINE_READY') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE_NAME);
      const matches = await Promise.all(PRECACHE_URLS.map((path) => cache.match(absoluteUrl(path), { ignoreSearch: true })));
      const result = {
        type: 'OFFLINE_READY',
        version: APP_VERSION,
        ready: matches.every(Boolean)
      };
      if (event.ports?.[0]) event.ports[0].postMessage(result);
      else event.source?.postMessage(result);
    })());
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApp().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName = CACHE_NAME) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

async function navigationFallback(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedPage = await cache.match(absoluteUrl('./index.html'), { ignoreSearch: true });
  if (cachedPage) return cachedPage;

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response?.ok) cache.put(absoluteUrl('./index.html'), response.clone()).catch(() => {});
    return response;
  } catch (error) {
    return new Response('离线资源尚未安装完成，请联网打开一次后再使用。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(navigationFallback(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
  }
});
