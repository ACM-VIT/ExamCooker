import assert from "node:assert/strict";
import { shouldArmStuckLoadTimeout } from "../lib/media/inline-youtube-watchdog";

assert.equal(
  shouldArmStuckLoadTimeout("loading"),
  true,
  "initial player loads still arm the stuck-load timeout",
);

assert.equal(
  shouldArmStuckLoadTimeout("ready"),
  false,
  "ready videos must not fail solely because playback buffering lasts",
);

assert.equal(
  shouldArmStuckLoadTimeout("error"),
  false,
  "errored videos should not arm another stuck-load timeout",
);

console.log("inline YouTube watchdog tests passed");
