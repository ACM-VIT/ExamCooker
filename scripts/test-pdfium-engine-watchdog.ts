import assert from "node:assert/strict";
import { getPdfiumEngineWatchdogOutcome } from "../lib/pdf/pdfium-engine-cache";

assert.equal(
  getPdfiumEngineWatchdogOutcome({
    hasCachedEngine: false,
    currentGeneration: null,
    watchedGeneration: 1,
  }),
  "timeout",
  "a sibling must keep its original deadline after the shared attempt is invalidated",
);

assert.equal(
  getPdfiumEngineWatchdogOutcome({
    hasCachedEngine: false,
    currentGeneration: 2,
    watchedGeneration: 1,
  }),
  "watch_replacement",
  "a viewer may join a genuinely newer active attempt",
);

assert.equal(
  getPdfiumEngineWatchdogOutcome({
    hasCachedEngine: true,
    currentGeneration: null,
    watchedGeneration: 1,
  }),
  "loaded",
  "a completed shared engine wins a timer race",
);

console.log("PDFium shared watchdog tests passed");
