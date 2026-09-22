import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaptureResult } from "posthog-js";
import { getPostHogClientConfig } from "./shared";

const beforeSend = getPostHogClientConfig().before_send as (
    result: CaptureResult | null,
) => CaptureResult | null;

function exceptionEvent(
    exceptionList: unknown[],
    properties: Record<string, unknown> = {},
): CaptureResult {
    return {
        event: "$exception",
        properties: { $exception_list: exceptionList, ...properties },
    } as unknown as CaptureResult;
}

// posthog-js aborts its own request with a plain Error named AbortError and a
// minified in_app frame, so the frame-less guards never catch it.
const posthogTimeoutEntry = {
    type: "AbortError",
    value: "PostHog request timed out after 3000ms",
    stacktrace: {
        frames: [{ filename: "/ecp/static/chunk.js", function: "a", in_app: true }],
    },
};

test("drops posthog-js own request-timeout abort noise", () => {
    assert.equal(beforeSend(exceptionEvent([posthogTimeoutEntry])), null);
});

test("drops the timeout abort variant without an ms suffix", () => {
    assert.equal(
        beforeSend(
            exceptionEvent([
                { ...posthogTimeoutEntry, value: "PostHog request timed out" },
            ]),
        ),
        null,
    );
});

test("keeps a genuine AbortError from application code", () => {
    const event = exceptionEvent([
        {
            type: "AbortError",
            value: "The user aborted a request.",
            stacktrace: { frames: [{ filename: "/app/page.js" }] },
        },
    ]);
    assert.equal(beforeSend(event), event);
});

test("keeps an event chaining the SDK timeout with a real exception", () => {
    const event = exceptionEvent([
        posthogTimeoutEntry,
        {
            type: "TypeError",
            value: "Cannot read properties of undefined",
            stacktrace: { frames: [{ filename: "/app/page.js" }] },
        },
    ]);
    assert.equal(beforeSend(event), event);
});
