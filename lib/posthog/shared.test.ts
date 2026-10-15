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

function exceptionEvent(
  frames: unknown[],
  value = WALLET_MESSAGE,
): CaptureResult {
  return {
    uuid: "test",
    event: "$exception",
    properties: {
      $current_url: PAGE_URL,
      $exception_list: [
        {
          type: "TypeError",
          value,
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

test("drops the Brave for iOS wallet throw when the page URL has a query string", () => {
  const event = exceptionEvent([{ function: "global code", filename: PAGE_URL }]);
  event.properties.$current_url = `${PAGE_URL}?exam=cat-2&sort=year_desc`;
  assert.equal(beforeSend(event), null);
});

test("keeps a window.ethereum error from a global code frame in an app bundle", () => {
  const event = exceptionEvent([
    {
      function: "global code",
      filename: "https://examcooker.acmvit.in/_next/static/chunks/app.js",
    },
  ]);
  assert.equal(beforeSend(event), event);
});

test("keeps a window.ethereum error from a global code frame with no filename", () => {
  const event = exceptionEvent([{ function: "global code" }]);
  assert.equal(beforeSend(event), event);
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
  const event = exceptionEvent(
    [{ function: "global code", filename: PAGE_URL }],
    "undefined is not an object (evaluating 'window.app.init')",
  );
  assert.equal(beforeSend(event), event);
});
