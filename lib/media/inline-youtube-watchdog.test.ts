import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STUCK_TIMEOUT_BASE_MS,
  STUCK_TIMEOUT_MAX_MS,
  getStuckTimeoutMs,
  shouldArmStuckLoadTimeout,
} from "./inline-youtube-watchdog";

test("the watchdog only runs while a requested play is still loading", () => {
  assert.equal(shouldArmStuckLoadTimeout("loading", true), true);
  assert.equal(shouldArmStuckLoadTimeout("loading", false), false);
  assert.equal(shouldArmStuckLoadTimeout("ready", true), false);
  assert.equal(shouldArmStuckLoadTimeout("error", true), false);
});

test("retries back off up to a cap", () => {
  assert.equal(getStuckTimeoutMs(0), STUCK_TIMEOUT_BASE_MS);
  assert.equal(getStuckTimeoutMs(1), STUCK_TIMEOUT_BASE_MS * 2);
  assert.equal(getStuckTimeoutMs(50), STUCK_TIMEOUT_MAX_MS);
  assert.equal(getStuckTimeoutMs(Number.NaN), STUCK_TIMEOUT_BASE_MS);
});
