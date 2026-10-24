import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceStartCoordinator } from "./voice-start-coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test("rapid starts share one key setup and cancelling does not open another", async () => {
  const voiceKey = deferred<boolean>();
  const features: string[] = [];
  let voiceChecks = 0;
  let connectionCount = 0;
  const coordinator = createVoiceStartCoordinator({
    ensureAiReady: async (feature) => {
      features.push(feature);
      if (feature === "voiceDocument") return true;
      return ++voiceChecks === 1 ? voiceKey.promise : true;
    },
    connect: async () => { connectionCount += 1; },
    onError: (error) => { throw error; },
  });

  const first = coordinator.start();
  assert.equal(await coordinator.start(), false);
  voiceKey.resolve(false);
  assert.equal(await first, false);
  assert.deepEqual(features, ["voiceDocument", "voice"]);
  assert.equal(connectionCount, 0);
  assert.equal(coordinator.isPending(), false);
  assert.equal(await coordinator.start(), true);
  assert.deepEqual(features, ["voiceDocument", "voice", "voiceDocument", "voice"]);
  assert.equal(connectionCount, 1);
});

test("stop permits a new start while the previous connection is pending", async () => {
  const firstConnection = deferred<void>();
  const secondConnection = deferred<void>();
  let connectionCount = 0;
  const coordinator = createVoiceStartCoordinator({
    ensureAiReady: async () => true,
    connect: () => ++connectionCount === 1 ? firstConnection.promise : secondConnection.promise,
    onError: (error) => { throw error; },
  });

  const first = coordinator.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(connectionCount, 1);
  coordinator.cancel();
  const second = coordinator.start();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(connectionCount, 2);
  firstConnection.resolve();
  assert.equal(await first, false);
  assert.equal(coordinator.isPending(), true);
  secondConnection.resolve();
  assert.equal(await second, true);
  assert.equal(coordinator.isPending(), false);
});
