import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

function makeServiceWorkerHarness({ fetchImpl, offlineResponse = null } = {}) {
  const listeners = new Map();
  const cachePuts = [];
  const cacheMatches = [];
  const cacheDeletes = [];

  const cache = {
    async addAll() {},
    async match(request) {
      cacheMatches.push(request);
      return undefined;
    },
    async put(request, response) {
      cachePuts.push({ request, response });
    },
  };

  const context = {
    Response,
    URL,
    caches: {
      async delete(name) {
        cacheDeletes.push(name);
        return true;
      },
      async keys() {
        return [];
      },
      async match(request) {
        cacheMatches.push(request);
        if (request === "/offline.html") return offlineResponse;
        return undefined;
      },
      async open() {
        return cache;
      },
    },
    fetch: fetchImpl ?? (async () => new Response("ok")),
    self: {
      clients: {
        async claim() {},
      },
      location: {
        origin: "https://examcooker.test",
      },
      registration: {},
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      skipWaiting() {},
    },
    setTimeout,
  };
  context.globalThis = context;

  return {
    cacheDeletes,
    cacheMatches,
    cachePuts,
    context,
    listeners,
  };
}

function makeFetchEvent(request) {
  const waitUntilPromises = [];
  let responsePromise = null;

  return {
    request,
    get responsePromise() {
      return responsePromise;
    },
    waitUntil(promise) {
      waitUntilPromises.push(promise);
    },
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
    async settleWaitUntil() {
      await Promise.all(waitUntilPromises);
    },
  };
}

function makeRequest(url, options = {}) {
  return {
    headers: new Headers(options.headers),
    method: options.method ?? "GET",
    mode: options.mode ?? "same-origin",
    url,
  };
}

async function loadServiceWorker(harness) {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  vm.runInNewContext(source, harness.context, { filename: "public/sw.js" });
}

async function testHtmlNavigationIsNetworkOnly() {
  const harness = makeServiceWorkerHarness({
    fetchImpl: async () => new Response("Welcome back, Alice", { status: 200 }),
  });
  await loadServiceWorker(harness);

  const event = makeFetchEvent(
    makeRequest("https://examcooker.test/", {
      headers: { accept: "text/html" },
      mode: "navigate",
    }),
  );
  harness.listeners.get("fetch")(event);

  assert.ok(event.responsePromise, "navigation should be handled by the service worker");
  const response = await event.responsePromise;
  assert.equal(await response.text(), "Welcome back, Alice");
  await event.settleWaitUntil();
  assert.equal(harness.cachePuts.length, 0, "HTML navigations must not be cached");
}

async function testHtmlNavigationKeepsOfflineFallback() {
  const offlineResponse = new Response("offline", { status: 200 });
  const harness = makeServiceWorkerHarness({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    offlineResponse,
  });
  await loadServiceWorker(harness);

  const event = makeFetchEvent(
    makeRequest("https://examcooker.test/notes", {
      headers: { accept: "text/html" },
      mode: "navigate",
    }),
  );
  harness.listeners.get("fetch")(event);

  assert.ok(event.responsePromise, "navigation should be handled by the service worker");
  const response = await event.responsePromise;
  assert.equal(await response.text(), "offline");
  assert.deepEqual(harness.cacheMatches, ["/offline.html"]);
  assert.equal(harness.cachePuts.length, 0, "offline fallback should not cache failed HTML");
}

async function testNativePrefetchDoesNotPersistPages() {
  const fetchedRoutes = [];
  const harness = makeServiceWorkerHarness({
    fetchImpl: async (route) => {
      fetchedRoutes.push(route);
      return new Response("prefetched", { status: 200 });
    },
  });
  await loadServiceWorker(harness);

  let waitUntilPromise = null;
  harness.listeners.get("message")({
    data: {
      type: "PREFETCH_ROUTES",
      routes: ["/", "/mod", "/notes"],
    },
    waitUntil(promise) {
      waitUntilPromise = promise;
    },
  });

  assert.ok(waitUntilPromise, "prefetch message should schedule work");
  await waitUntilPromise;
  assert.deepEqual(fetchedRoutes, ["/", "/notes"]);
  assert.equal(harness.cachePuts.length, 0, "prefetched pages must not be cached");
}

await testHtmlNavigationIsNetworkOnly();
await testHtmlNavigationKeepsOfflineFallback();
await testNativePrefetchDoesNotPersistPages();

console.log("Service worker cache policy tests passed");
