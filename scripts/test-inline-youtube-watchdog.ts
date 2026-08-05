import assert from "node:assert/strict";
import {
  getStuckTimeoutMs,
  shouldArmStuckLoadTimeout,
  STUCK_TIMEOUT_BASE_MS,
} from "../lib/media/inline-youtube-watchdog";

assert.equal(
  shouldArmStuckLoadTimeout("loading", true),
  true,
  "a loading embed that is actively trying to play arms the stuck-load timeout",
);

assert.equal(
  shouldArmStuckLoadTimeout("loading", false),
  false,
  "a loaded-but-idle embed (user hasn't pressed play) must not be failed on elapsed time",
);

assert.equal(
  shouldArmStuckLoadTimeout("ready", true),
  false,
  "ready videos must not fail solely because playback buffering lasts",
);

assert.equal(
  shouldArmStuckLoadTimeout("error", true),
  false,
  "errored videos should not arm another stuck-load timeout",
);

assert.equal(
  getStuckTimeoutMs(0),
  STUCK_TIMEOUT_BASE_MS,
  "the first play attempt waits the base budget",
);

assert.equal(
  getStuckTimeoutMs(1),
  STUCK_TIMEOUT_BASE_MS * 2,
  "the first retry escalates to a longer budget instead of replaying the same wait",
);

assert.equal(
  getStuckTimeoutMs(2),
  STUCK_TIMEOUT_BASE_MS * 3,
  "each subsequent retry keeps backing off",
);

assert.equal(
  getStuckTimeoutMs(-5),
  STUCK_TIMEOUT_BASE_MS,
  "a nonsensical negative attempt falls back to the base budget",
);

console.log("inline YouTube watchdog tests passed");
