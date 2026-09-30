import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaptureResult } from "posthog-js";
import { getPostHogClientConfig } from "./shared";

const PAGE_URL = "https://examcooker.acmvit.in/past_papers/BCSE305L";
const WALLET_MESSAGE =
  "undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')";

const beforeSend = getPostHogClientConfig().before_send as (
  result: CaptureResult | null,
) => CaptureResult | null;

function exceptionEvent(frames: unknown[]): CaptureResult {
  return {
    uuid: "test",
    event: "$exception",
    properties: {
      $current_url: PAGE_URL,
      $exception_list: [
        {
          type: "TypeError",
          value: WALLET_MESSAGE,
          stacktrace: { type: "raw", frames },
        },
      ],
    },
  } as unknown as CaptureResult;
}

test("drops the Brave for iOS wallet throw from a global code frame", () => {
  const event = exceptionEvent([
    { function: "global code", filename: PAGE_URL, lineno: 1 },
  ]);
  assert.equal(beforeSend(event), null);
});

test("drops the Brave for iOS wallet throw from a page document frame", () => {
  const event = exceptionEvent([{ function: "?", filename: PAGE_URL }]);
  assert.equal(beforeSend(event), null);
});

test("keeps a window.ethereum error that has an app bundle frame", () => {
  const event = exceptionEvent([
    { function: "global code", filename: PAGE_URL },
    {
      function: "connect",
      filename: "https://examcooker.acmvit.in/_next/static/chunks/app.js",
    },
  ]);
  assert.equal(beforeSend(event), event);
});

test("keeps a window.ethereum error with no frames", () => {
  const event = exceptionEvent([]);
  assert.equal(beforeSend(event), event);
});

test("keeps a document-level error that does not mention window.ethereum", () => {
  const event = exceptionEvent([{ function: "global code" }]);
  const entry = (
    event.properties.$exception_list as { value: string }[]
  )[0];
  entry.value = "undefined is not an object (evaluating 'window.app.init')";
  assert.equal(beforeSend(event), event);
});
