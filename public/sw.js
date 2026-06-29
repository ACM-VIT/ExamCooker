const CACHE_VERSION = "v6";
const STATIC_CACHE = `examcooker-static-${CACHE_VERSION}`;
const PAGE_CACHE = `examcooker-pages-${CACHE_VERSION}`;
const RUNTIME_CACHE = `examcooker-runtime-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/assets/logo-icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

const KNOWN_CACHES = new Set([STATIC_CACHE, PAGE_CACHE, RUNTIME_CACHE]);
const EXAMCOOKER_CACHE_PREFIXES = [
  "examcooker-static-",
  "examcooker-pages-",
  "examcooker-runtime-",
];

const STATIC_PATH_PREFIXES = ["/_next/static/", "/icons/", "/assets/", "/vendor/"];
const STATIC_PATH_EXACT = new Set(["/manifest.webmanifest", "/offline.html", "/sw.js"]);
const NO_CACHE_PATH_EXACT = new Set(["/", "/auth"]);
const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const NO_CACHE_PATH_PREFIXES = [
  "/api/",
  "/auth/",
  "/vendor/embedpdf/",
  "/native-auth/",
  "/_next/data/",
  "/_next/image",
  "/signin",
  "/ecp/",
  "/mod",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isStaticAsset(url) {
  if (STATIC_PATH_EXACT.has(url.pathname)) return true;
  if (STATIC_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }
  if (FONT_HOSTS.has(url.host)) return true;
  return false;
}

function isUncacheable(url) {
  return (
    NO_CACHE_PATH_EXACT.has(url.pathname) ||
    NO_CACHE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
  );
}

function isHtmlAccept(request) {
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

function isExamCookerCache(name) {
  return EXAMCOOKER_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isRoutePayloadRequest(request, url) {
  const accept = request.headers.get("accept") || "";
  return isSameOrigin(url) && (url.searchParams.has("_rsc") || accept.includes("text/x-component"));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const staleCacheDeletes = [];
      for (const name of names) {
        if (isExamCookerCache(name) && !KNOWN_CACHES.has(name)) {
          staleCacheDeletes.push(caches.delete(name));
        }
      }

      await Promise.all([
        Promise.all(staleCacheDeletes),
        self.registration.navigationPreload
          ? self.registration.navigationPreload.enable().catch(() => undefined)
          : Promise.resolve(undefined),
        self.clients.claim(),
      ]);
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data.type === "PREFETCH_ROUTES" && Array.isArray(event.data.routes)) {
    event.waitUntil(
      (async () => {
        for (const route of event.data.routes) {
          if (typeof route !== "string" || !route.startsWith("/")) continue;
          const url = new URL(route, self.location.origin);
          if (isUncacheable(url)) continue;
          try {
            await fetch(route, { credentials: "same-origin" });
          } catch {
            // Prefetching is best-effort.
          }
          await wait(120);
        }
      })(),
    );
  }
});

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type === "opaque") {
    return false;
  }

  const cacheControl = response.headers.get("cache-control") || "";
  if (/(^|,\s*)(no-store|no-cache|private)(\s|,|=|$)/i.test(cacheControl)) {
    return false;
  }

  return !response.headers.has("set-cookie");
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(event.request, { ignoreSearch: false });

  const networkFetch = fetch(event.request)
    .then((response) => {
      if (isCacheableResponse(response)) {
        cache.put(event.request, response.clone()).catch(() => undefined);
      }
      return response;
    })
    .catch(() => undefined);

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }

  const network = await networkFetch;
  if (network) return network;
  const offline = await caches.match("/offline.html");
  return offline || Response.error();
}

function getNavigationPreload(event) {
  if (!("preloadResponse" in event)) return null;
  const preloadResponse = event.preloadResponse.catch(() => undefined);
  event.waitUntil(preloadResponse.then(() => undefined));
  return preloadResponse;
}

async function networkOnly(event, preloadResponsePromise = null) {
  const preloadResponse = preloadResponsePromise ? await preloadResponsePromise : undefined;
  if (preloadResponse) return preloadResponse;

  try {
    return await fetch(event.request);
  } catch {
    return Response.error();
  }
}

async function networkOnlyWithOfflineFallback(event, preloadResponsePromise = null) {
  const response = await networkOnly(event, preloadResponsePromise);
  if (response && response.type !== "error" && response.ok) return response;
  const offline = await caches.match("/offline.html");
  return offline || response;
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  if (cached) {
    event.waitUntil(
      fetch(event.request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            return cache.put(event.request, response.clone());
          }
          return undefined;
        })
        .catch(() => undefined),
    );
    return cached;
  }
  try {
    const response = await fetch(event.request);
    if (isCacheableResponse(response)) {
      cache.put(event.request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (request.mode === "navigate") {
    if (isUncacheable(url)) return;

    const preloadResponsePromise = getNavigationPreload(event);
    event.respondWith(networkOnlyWithOfflineFallback(event, preloadResponsePromise));
    return;
  }

  if (isRoutePayloadRequest(request, url)) {
    if (isUncacheable(url)) return;
    event.respondWith(networkOnly(event));
    return;
  }

  if (!isSameOrigin(url) && !FONT_HOSTS.has(url.host)) {
    return;
  }

  if (isUncacheable(url)) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event));
    return;
  }

  if (isHtmlAccept(request)) {
    event.respondWith(networkOnlyWithOfflineFallback(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE));
});
