import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { setImmediate as nextTask } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Window } from "happy-dom";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmModulesPath = join(repositoryRoot, "node_modules", ".pnpm");
const reactPlayerPackageDirectories = readdirSync(pnpmModulesPath).filter((entry) =>
  entry.startsWith("react-player@3.4.0_"),
);

assert.equal(
  reactPlayerPackageDirectories.length,
  1,
  "Expected exactly one installed react-player@3.4.0 package",
);

const youtubeModulePath = join(
  pnpmModulesPath,
  reactPlayerPackageDirectories[0],
  "node_modules",
  "youtube-video-element",
  "dist",
  "youtube-video-element.js",
);
const nativeSetInterval = globalThis.setInterval;
const nativeClearInterval = globalThis.clearInterval;
const nativeFetch = globalThis.fetch;
const intervals = new Map();
let nextIntervalId = 0;
let playerMode = "healthy";
let apiPropertyReads = {};
let deferPlayerReady = false;
let pendingPlayerReady = [];
let resolveNextPlayerConstruction;
let playerEventListeners = {};

const window = new Window({
  url: "https://offline.invalid/",
  settings: {
    disableCSSFileLoading: true,
    disableIframePageLoading: true,
    disableJavaScriptFileLoading: true,
  },
});

globalThis.window = window;
globalThis.document = window.document;
globalThis.HTMLElement = window.HTMLElement;
globalThis.customElements = window.customElements;
globalThis.Event = window.Event;
globalThis.self = globalThis;
globalThis.fetch = () => {
  throw new Error("Network access is disabled in this test");
};
window.fetch = globalThis.fetch;

globalThis.setInterval = (callback, delay) => {
  const id = ++nextIntervalId;
  intervals.set(id, { callback, delay, active: true });
  return id;
};
globalThis.clearInterval = (id) => {
  const interval = intervals.get(id);
  if (interval) interval.active = false;
};

function createFakePlayer() {
  const player = {
    addEventListener(name, listener) {
      playerEventListeners[name] = listener;
    },
  };

  if (playerMode === "healthy") {
    Object.assign(player, {
      getCurrentTime() {
        return 0;
      },
      getDuration() {
        return 120;
      },
      getVideoLoadedFraction() {
        return 0.5;
      },
    });
  }

  const trackedProperties = new Set([
    "getCurrentTime",
    "getDuration",
    "getVideoLoadedFraction",
  ]);
  return new Proxy(player, {
    get(target, property, receiver) {
      if (trackedProperties.has(property)) {
        apiPropertyReads[property] = (apiPropertyReads[property] ?? 0) + 1;
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function waitForPlayerConstruction() {
  return new Promise((resolve) => {
    resolveNextPlayerConstruction = resolve;
  });
}

globalThis.YT = {
  Player: class FakeYouTubePlayer {
    constructor(_iframe, options) {
      const player = createFakePlayer();
      resolveNextPlayerConstruction?.();
      resolveNextPlayerConstruction = undefined;
      if (deferPlayerReady) {
        pendingPlayerReady.push(() => options.events.onReady());
      } else {
        queueMicrotask(() => options.events.onReady());
      }
      return player;
    }
  },
  PlayerState: {
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
  },
};

await import(pathToFileURL(youtubeModulePath).href);

function getScenarioIntervals(existingIntervalIds) {
  return [...intervals.entries()].filter(([id]) => !existingIntervalIds.has(id));
}

function assertExactlyOneActivePair(scenarioIntervals, message) {
  assert.deepEqual(
    scenarioIntervals
      .filter(([, interval]) => interval.active)
      .map(([, interval]) => interval.delay)
      .sort((left, right) => left - right),
    [50, 100],
    message,
  );
}

function runActiveIntervals(scenarioIntervals) {
  for (const [, interval] of scenarioIntervals) {
    if (interval.active) interval.callback();
  }
}

function assertPollingOccurred(readsBeforePolling, message) {
  for (const property of [
    "getCurrentTime",
    "getDuration",
    "getVideoLoadedFraction",
  ]) {
    assert.ok(
      (apiPropertyReads[property] ?? 0) > (readsBeforePolling[property] ?? 0),
      `${message}: expected ${property} to be read`,
    );
  }
}

async function verifyRemovalAndReconnect(mode) {
  playerMode = mode;
  apiPropertyReads = {};
  playerEventListeners = {};
  const existingIntervalIds = new Set(intervals.keys());
  const element = document.createElement("youtube-video");
  document.body.append(element);
  const loaded = new Promise((resolve) => {
    element.addEventListener("loadcomplete", resolve, { once: true });
  });

  element.src = "https://www.youtube.com/watch?v=abcdefghijk";
  await loaded;
  await nextTask();

  const initialIntervals = getScenarioIntervals(existingIntervalIds);
  assertExactlyOneActivePair(
    initialIntervals,
    `${mode}: expected the dependency to schedule its two polling intervals`,
  );

  const readsAtRemoval = { ...apiPropertyReads };
  element.remove();

  assert.equal(element.isConnected, false, `${mode}: element should be detached`);
  assert.ok(
    initialIntervals.every(([, interval]) => !interval.active),
    `${mode}: every polling interval should be cleared on removal`,
  );

  runActiveIntervals(initialIntervals);
  assert.deepEqual(
    apiPropertyReads,
    readsAtRemoval,
    `${mode}: detached element should not poll the player API`,
  );

  const intervalIdsBeforeReconnect = new Set(intervals.keys());
  const readsBeforeReconnectPolling = { ...apiPropertyReads };
  document.body.append(element);
  await nextTask();

  const reconnectIntervals = getScenarioIntervals(intervalIdsBeforeReconnect);
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: reconnect should schedule exactly one fresh interval pair`,
  );
  runActiveIntervals(reconnectIntervals);
  assertPollingOccurred(
    readsBeforeReconnectPolling,
    `${mode}: reconnect should resume polling`,
  );
  assert.doesNotThrow(
    () =>
      playerEventListeners.onStateChange({
        data: globalThis.YT.PlayerState.PAUSED,
      }),
    `${mode}: state changes should continue working after reconnect`,
  );
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: reconnect polling should not create duplicate intervals`,
  );

  element.remove();
  assert.ok(
    reconnectIntervals.every(([, interval]) => !interval.active),
    `${mode}: reconnected polling intervals should clear on removal`,
  );
}

async function verifyDisconnectBeforeLoadComplete(mode) {
  playerMode = mode;
  apiPropertyReads = {};
  playerEventListeners = {};
  deferPlayerReady = true;
  pendingPlayerReady = [];
  const existingIntervalIds = new Set(intervals.keys());
  const element = document.createElement("youtube-video");
  document.body.append(element);
  const loaded = new Promise((resolve) => {
    element.addEventListener("loadcomplete", resolve, { once: true });
  });
  const playerConstructed = waitForPlayerConstruction();

  element.src = "https://www.youtube.com/watch?v=abcdefghijk";
  await playerConstructed;
  assert.equal(pendingPlayerReady.length, 1, `${mode}: expected deferred readiness`);

  element.remove();
  pendingPlayerReady.shift()();
  await loaded;
  await nextTask();

  assert.equal(element.isLoaded, true, `${mode}: player should finish loading`);
  assert.equal(element.isConnected, false, `${mode}: element should stay detached`);
  assert.equal(
    getScenarioIntervals(existingIntervalIds).length,
    0,
    `${mode}: load completion must not schedule polling while detached`,
  );

  const readsBeforeReconnectPolling = { ...apiPropertyReads };
  document.body.append(element);
  await nextTask();

  const reconnectIntervals = getScenarioIntervals(existingIntervalIds);
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: reconnect after detached load completion should start one interval pair`,
  );
  runActiveIntervals(reconnectIntervals);
  assertPollingOccurred(
    readsBeforeReconnectPolling,
    `${mode}: reconnect after load completion should resume polling`,
  );
  assert.doesNotThrow(
    () =>
      playerEventListeners.onStateChange({
        data: globalThis.YT.PlayerState.PAUSED,
      }),
    `${mode}: state changes should work after detached load completion`,
  );
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: detached load completion and reconnect must not duplicate intervals`,
  );

  element.remove();
  assert.ok(
    reconnectIntervals.every(([, interval]) => !interval.active),
    `${mode}: reconnect intervals should clear after the final removal`,
  );
  deferPlayerReady = false;
  pendingPlayerReady = [];
}

async function verifyReconnectBeforeLoadComplete(mode) {
  playerMode = mode;
  apiPropertyReads = {};
  playerEventListeners = {};
  deferPlayerReady = true;
  pendingPlayerReady = [];
  const existingIntervalIds = new Set(intervals.keys());
  const element = document.createElement("youtube-video");
  document.body.append(element);
  const loaded = new Promise((resolve) => {
    element.addEventListener("loadcomplete", resolve, { once: true });
  });
  const playerConstructed = waitForPlayerConstruction();

  element.src = "https://www.youtube.com/watch?v=abcdefghijk";
  await playerConstructed;
  element.remove();

  assert.equal(
    getScenarioIntervals(existingIntervalIds).length,
    0,
    `${mode}: disconnect before readiness must not start polling`,
  );

  document.body.append(element);
  assert.equal(
    getScenarioIntervals(existingIntervalIds).length,
    0,
    `${mode}: reconnect before readiness must wait for load completion`,
  );

  pendingPlayerReady.shift()();
  await loaded;
  await nextTask();

  const reconnectIntervals = getScenarioIntervals(existingIntervalIds);
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: load completion after reconnect should start one interval pair`,
  );
  const readsBeforePolling = { ...apiPropertyReads };
  runActiveIntervals(reconnectIntervals);
  assertPollingOccurred(
    readsBeforePolling,
    `${mode}: load completion after reconnect should poll`,
  );
  assert.doesNotThrow(
    () =>
      playerEventListeners.onStateChange({
        data: globalThis.YT.PlayerState.PAUSED,
      }),
    `${mode}: state changes should work when readiness follows reconnect`,
  );
  assertExactlyOneActivePair(
    reconnectIntervals,
    `${mode}: reconnect and later readiness must not duplicate intervals`,
  );

  element.remove();
  assert.ok(
    reconnectIntervals.every(([, interval]) => !interval.active),
    `${mode}: post-readiness intervals should clear on removal`,
  );
  deferPlayerReady = false;
  pendingPlayerReady = [];
}

test("removal stops and reconnect restarts healthy YouTube player polling", async () => {
  await verifyRemovalAndReconnect("healthy");
});

test("removal stops and reconnect restarts missing-method player polling", async () => {
  await verifyRemovalAndReconnect("missing-methods");
});

test("healthy player loading while detached starts polling only after reconnect", async () => {
  await verifyDisconnectBeforeLoadComplete("healthy");
});

test("missing-method player loading while detached starts polling only after reconnect", async () => {
  await verifyDisconnectBeforeLoadComplete("missing-methods");
});

test("healthy player reconnecting before load completion starts one pair when ready", async () => {
  await verifyReconnectBeforeLoadComplete("healthy");
});

test("missing-method player reconnecting before load completion starts one pair when ready", async () => {
  await verifyReconnectBeforeLoadComplete("missing-methods");
});

test.after(() => {
  globalThis.setInterval = nativeSetInterval;
  globalThis.clearInterval = nativeClearInterval;
  globalThis.fetch = nativeFetch;
  window.close();
});
