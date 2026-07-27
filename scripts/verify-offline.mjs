import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : projectRoot;
const scope = 'https://example.test/11408-notes/';
const listeners = new Map();
const stores = new Map();
let online = true;

function requestUrl(request) {
  return typeof request === 'string' ? request : request.url;
}

function cacheKey(request, ignoreSearch = false) {
  const url = new URL(requestUrl(request));
  if (ignoreSearch) url.search = '';
  return url.href;
}

class MemoryCache {
  constructor() {
    this.responses = new Map();
  }

  async addAll(urls) {
    for (const url of urls) {
      const response = await mockFetch(url);
      if (!response.ok) throw new Error(`Precache failed: ${requestUrl(url)}`);
      await this.put(url, response);
    }
  }

  async match(request, options = {}) {
    const key = cacheKey(request, options.ignoreSearch);
    if (!options.ignoreSearch) return this.responses.get(key)?.clone();
    for (const [storedKey, response] of this.responses) {
      if (cacheKey(storedKey, true) === key) return response.clone();
    }
    return undefined;
  }

  async put(request, response) {
    this.responses.set(cacheKey(request), response.clone());
  }
}

const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new MemoryCache());
    return stores.get(name);
  },
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  }
};

async function mockFetch(request) {
  if (!online) throw new TypeError('Network is offline');
  const url = new URL(requestUrl(request));
  const relativePath = decodeURIComponent(url.pathname.replace('/11408-notes/', '')) || 'index.html';
  const filePath = path.resolve(root, relativePath);
  assert.ok(filePath.startsWith(root + path.sep), `Unsafe path: ${relativePath}`);
  try {
    const body = await fs.readFile(filePath);
    return new Response(body, { status: 200 });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

const self = {
  registration: { scope },
  location: new URL('https://example.test/11408-notes/service-worker.js'),
  clients: { claim: async () => {} },
  skipWaiting: async () => {},
  addEventListener(type, listener) {
    listeners.set(type, listener);
  }
};

const source = await fs.readFile(path.join(root, 'service-worker.js'), 'utf8');
vm.runInNewContext(source, {
  self,
  caches,
  fetch: mockFetch,
  Request,
  Response,
  URL,
  Promise,
  console
}, { filename: 'service-worker.js' });

async function dispatchExtendable(type, event = {}) {
  let pending = Promise.resolve();
  listeners.get(type)({
    ...event,
    waitUntil(promise) {
      pending = Promise.resolve(promise);
    }
  });
  await pending;
}

async function dispatchFetch(request) {
  let responsePromise;
  listeners.get('fetch')({
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    }
  });
  assert.ok(responsePromise, `Service Worker ignored ${request.url}`);
  return responsePromise;
}

await dispatchExtendable('install');
await dispatchExtendable('activate');

const cacheNames = (await caches.keys()).filter((name) => !name.endsWith('runtime'));
assert.equal(cacheNames.length, 1);
const cache = await caches.open(cacheNames[0]);
assert.equal(cache.responses.size, 10, 'Every declared app-shell resource must be cached');

online = false;

const navigationResponse = await dispatchFetch({
  method: 'GET',
  mode: 'navigate',
  url: `${scope}unvisited-route`
});
assert.equal(navigationResponse.status, 200);
assert.match(await navigationResponse.text(), /11408 考研笔记框架系统/);

const scriptResponse = await dispatchFetch({
  method: 'GET',
  mode: 'same-origin',
  destination: 'script',
  url: `${scope}src/app.js?v=offline-test`
});
assert.equal(scriptResponse.status, 200);
assert.match(await scriptResponse.text(), /kaoyan11408_notes_db_v2/);

const mathJaxResponse = await dispatchFetch({
  method: 'GET',
  mode: 'same-origin',
  destination: 'script',
  url: `${scope}vendor/mathjax/tex-svg.js`
});
assert.equal(mathJaxResponse.status, 200);
assert.ok((await mathJaxResponse.arrayBuffer()).byteLength > 2_000_000);

const coreFiles = ['index.html', 'src/app.js', 'src/pwa.js', 'styles/app.css', 'service-worker.js'];
for (const file of coreFiles) {
  const text = await fs.readFile(path.join(root, file), 'utf8');
  assert.doesNotMatch(
    text,
    /https?:\/\/(?:cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/,
    `${file} still contains an external runtime dependency`
  );
}

const annotationHtml = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const annotationJs = await fs.readFile(path.join(root, 'src/app.js'), 'utf8');
const annotationCss = await fs.readFile(path.join(root, 'styles/app.css'), 'utf8');
assert.match(annotationHtml, /id="annotationCanvas"/);
assert.match(annotationHtml, /id="annotationSettingsPanel"/);
assert.match(annotationJs, /event\.pointerType !== 'pen'/);
assert.match(annotationJs, /node\.annotations/);
assert.match(annotationJs, /idbSet\(DATA_KEY, state\)/);
assert.match(annotationJs, /sanitizeAnnotationPoints/);
assert.match(annotationJs, /clientX < shellRect\.left/);
assert.match(annotationJs, /distance > maxContinuousJump/);
assert.match(annotationCss, /\.annotation-canvas/);

console.log('Offline verification passed: app shell, navigation, scripts and MathJax work without network.');
console.log('Stylus verification passed: pen detection, annotation canvas and IndexedDB persistence are present.');
