import assert from "node:assert/strict";
import { test } from "node:test";
import type { CaptureResult } from "posthog-js";
import { getPostHogClientConfig } from "./shared";

const beforeSend = getPostHogClientConfig().before_send as (
    result: CaptureResult | null,
) => CaptureResult | null;

function exceptionEvent(exceptionList: unknown[]): CaptureResult {
    return {
        event: "$exception",
        properties: { $exception_list: exceptionList },
    } as unknown as CaptureResult;
}

function wrappedEntry(value: string, frames?: unknown[]) {
    return {
        type: "Error",
        value,
        mechanism: { handled: false, synthetic: true },
        ...(frames ? { stacktrace: { frames } } : {}),
    };
}

test("drops frame-less wrappers for plain objects, class instances, and events", () => {
    for (const value of [
        "Object captured as exception with keys: id, url",
        "'Foo' captured as exception with keys: [object has no keys]",
        "Event captured as exception with keys: isTrusted",
    ]) {
        assert.equal(beforeSend(exceptionEvent([wrappedEntry(value)])), null);
        assert.equal(beforeSend(exceptionEvent([wrappedEntry(value, [])])), null);
    }
});

test("keeps a keys wrapper that carries frames", () => {
    const event = exceptionEvent([
        wrappedEntry("Object captured as exception with keys: id, url", [
            { filename: "/app/page.js" },
        ]),
    ]);
    assert.equal(beforeSend(event), event);
});

test("keeps an event chaining a keys wrapper with a real exception", () => {
    const event = exceptionEvent([
        wrappedEntry("Object captured as exception with keys: id, url"),
        {
            type: "TypeError",
            value: "Cannot read properties of undefined",
            stacktrace: { frames: [{ filename: "/app/page.js" }] },
        },
    ]);
    assert.equal(beforeSend(event), event);
});

test("keeps messages that are not the keys wrapper", () => {
    for (const value of [
        "'Error' captured as exception with message: 'boom'",
        "Failed: Object captured as exception with keys: id",
    ]) {
        const event = exceptionEvent([wrappedEntry(value)]);
        assert.equal(beforeSend(event), event);
    }
});
