import type { CaptureResult, PostHogConfig } from "posthog-js";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

// Browsers emit a generic "Script error." with no stack trace when a
// cross-origin script throws without CORS headers + crossorigin="anonymous"
// (e.g. the Facebook in-app browser injection, browser extensions, third-party
// tags). These exceptions carry no actionable detail, so drop them client-side
// before they reach error tracking and bury real issues.
//
// We match ONLY the exact browser-sanitized sentinel — value === "Script error."
// with no trimming and no period-less variant — because "Script error" (no
// period) and surrounding whitespace can be the message of a genuine
// application error we must not hide.
const SCRIPT_ERROR_SENTINEL = "Script error.";

// Injected browser-extension content scripts whose RPC to their background page
// fails emit a well-known string into window.onunhandledrejection:
// "Object Not Found Matching Id:N, MethodName:update, ParamCount:4". posthog-js
// wraps the non-Error rejection value, so the captured message looks like
// "Non-Error promise rejection captured with value: Object Not Found Matching
// Id:6, MethodName:update, ParamCount:4". It carries no stack and no examcooker
// code, so it is pure noise we drop before it reaches error tracking.
//
// Match the exact wrapped extension message so unrelated non-Error rejections
// from app code still surface.
const EXTENSION_RPC_REJECTION_SIGNATURE =
    /^Non-Error promise rejection captured with value: Object Not Found Matching Id:\d+, MethodName:update, ParamCount:4$/;

// Browser extensions (commonly on Mobile Safari) that message their background
// page after their tab has gone away throw "Invalid call to
// runtime.sendMessage(). Tab not found." posthog-js captures the extension's
// synthetic, unhandled Error and wraps it, so the value looks like
// "'Error' captured as exception with message: 'Invalid call to
// runtime.sendMessage(). Tab not found.'". It carries no stack and no examcooker
// code, so it is pure noise we drop before it reaches error tracking.
//
// Match the exact wrapped extension message so a genuine app error that happens
// to mention runtime.sendMessage still surfaces.
const EXTENSION_SENDMESSAGE_SIGNATURE =
    /^'Error' captured as exception with message: 'Invalid call to runtime\.sendMessage\(\)\. Tab not found\.'$/;

function hasNoFrames(entry: { stacktrace?: { frames?: unknown[] } | null }) {
    // A genuinely sanitized/synthetic exception carries no usable stack. If the
    // entry has frames, it is a real, actionable exception that merely happens
    // to share the string, so it must survive.
    const frames = entry.stacktrace?.frames;
    return !Array.isArray(frames) || frames.length === 0;
}

function isUnactionableScriptError(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    if (entry.value !== SCRIPT_ERROR_SENTINEL) {
        return false;
    }

    return hasNoFrames(entry);
}

function isUnactionableExtensionRejection(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    if (
        typeof entry.value !== "string" ||
        !EXTENSION_RPC_REJECTION_SIGNATURE.test(entry.value)
    ) {
        return false;
    }

    return hasNoFrames(entry);
}

function isUnactionableExtensionSendMessage(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    if (
        typeof entry.value !== "string" ||
        !EXTENSION_SENDMESSAGE_SIGNATURE.test(entry.value)
    ) {
        return false;
    }

    return hasNoFrames(entry);
}

function isUnactionableEntry(exception: unknown): boolean {
    return (
        isUnactionableScriptError(exception) ||
        isUnactionableExtensionRejection(exception) ||
        isUnactionableExtensionSendMessage(exception)
    );
}

function isScriptErrorNoise(event: CaptureResult): boolean {
    if (event.event !== "$exception") {
        return false;
    }

    const exceptionList = event.properties?.$exception_list;
    if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
        return false;
    }

    // Only drop when EVERY entry in the (possibly chained) exception list is
    // unactionable. An event that chains a sanitized entry together with a real
    // exception (message/stack) keeps its actionable detail and must not be
    // discarded wholesale.
    return exceptionList.every(isUnactionableEntry);
}

function dropScriptErrorNoise(
    event: CaptureResult | null,
): CaptureResult | null {
    if (event && isScriptErrorNoise(event)) {
        return null;
    }

    return event;
}

function readEnv(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export const POSTHOG_FEATURE_FLAGS = {
    commandPalette: "command_palette",
    voiceAgent: "voice-agent-enabled",
} as const;

export function getPostHogProjectKey() {
    return (
        readEnv(process.env.NEXT_PUBLIC_POSTHOG_TOKEN) ??
        readEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY)
    );
}

export function getPostHogHost() {
    return (
        readEnv(process.env.NEXT_PUBLIC_POSTHOG_HOST) ??
        readEnv(process.env.POSTHOG_HOST) ??
        DEFAULT_POSTHOG_HOST
    );
}

export function getPostHogProxyPath() {
    const proxyPath = readEnv(process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH);
    if (!proxyPath) return undefined;
    return proxyPath.startsWith("/") ? proxyPath : `/${proxyPath}`;
}

export function getPostHogUiHost(posthogHost = getPostHogHost()) {
    const configuredUiHost = readEnv(process.env.NEXT_PUBLIC_POSTHOG_UI_HOST);
    if (configuredUiHost) {
        return configuredUiHost;
    }

    if (posthogHost.includes("eu.i.posthog.com")) {
        return "https://eu.posthog.com";
    }

    if (posthogHost.includes("us.i.posthog.com")) {
        return "https://us.posthog.com";
    }

    return undefined;
}

// Firefox throws a cross-origin `SecurityError` DOMException inside PostHog's own
// rrweb session recorder when it tries to read the contents of the cross-origin
// YouTube iframe embedded on past-paper pages. The iframe load itself is unaffected,
// but `capture_exceptions` reports the swallowed throw as an error-tracking issue.
// This is SDK noise, not an app bug, so drop it before it leaves the browser.
//
// Matches the browser-specific cross-origin access messages only. We deliberately
// do NOT drop on the recorder frame alone, so genuine recorder-side DOMExceptions
// (AbortError, NotAllowedError, QuotaExceededError, InvalidStateError, ...) still
// reach error tracking.
const CROSS_ORIGIN_SECURITY_ERROR =
    /SecurityError|cross-origin|Permission denied to access property|Blocked a frame with origin/i;

function isPostHogRecorderFrame(filename: string): boolean {
    return (
        filename.includes("posthog-recorder") ||
        filename.includes("lazy-recorder") ||
        filename.includes("rrweb")
    );
}

function isRrwebCrossOriginIframeException(result: CaptureResult): boolean {
    if (result.event !== "$exception") return false;

    const exceptionList = result.properties?.$exception_list;
    if (!Array.isArray(exceptionList)) return false;

    return exceptionList.some((exception) => {
        if (exception?.type !== "DOMException") return false;

        // Require the specific cross-origin SecurityError signature, not just a
        // DOMException. The browser-sanitized name can surface in either the
        // exception type or its message, so check both.
        const value = typeof exception?.value === "string" ? exception.value : "";
        const type = typeof exception?.type === "string" ? exception.type : "";
        if (
            !CROSS_ORIGIN_SECURITY_ERROR.test(value) &&
            !CROSS_ORIGIN_SECURITY_ERROR.test(type)
        ) {
            return false;
        }

        const frames = exception?.stacktrace?.frames;
        if (!Array.isArray(frames)) return false;

        return frames.some((frame) => {
            const filename =
                typeof frame?.filename === "string" ? frame.filename : "";
            return isPostHogRecorderFrame(filename);
        });
    });
}

// On iOS, Capacitor's injected `native-bridge.js` registers a `pagehide`
// listener (`sendPageHideMessage`) that funnels through `sendDataToNative`,
// which posts to `window.webkit.messageHandlers.bridge`. While the WKWebView is
// tearing down during navigation, `window.webkit.messageHandlers` is already
// `undefined`, so the access throws
// `TypeError: undefined is not an object (evaluating 'window.webkit.messageHandlers')`.
// posthog-js (running inside the WebView) then captures it as an unhandled
// exception. The page is already unloading, so nothing user-facing breaks — it
// is pure teardown-race noise from a third-party bridge, not our code.
//
// We match narrowly: the exact `window.webkit.messageHandlers` access message
// AND a Capacitor bridge frame (`sendPageHideMessage` / `sendDataToNative`).
// Neither symbol exists anywhere in examcooker's own code, and requiring the
// bridge frame keeps any unrelated future `webkit.messageHandlers` throw
// visible.
const CAPACITOR_WEBKIT_HANDLER_MESSAGE = "window.webkit.messageHandlers";
const CAPACITOR_BRIDGE_FRAME_FUNCTIONS = new Set([
    "sendPageHideMessage",
    "sendDataToNative",
]);

function hasCapacitorBridgeFrame(exception: {
    stacktrace?: { frames?: unknown[] } | null;
}): boolean {
    const frames = exception.stacktrace?.frames;
    if (!Array.isArray(frames)) return false;

    return frames.some((frame) => {
        const fn =
            frame && typeof frame === "object"
                ? (frame as { function?: unknown }).function
                : undefined;
        return typeof fn === "string" && CAPACITOR_BRIDGE_FRAME_FUNCTIONS.has(fn);
    });
}

function isCapacitorTeardownException(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        type?: unknown;
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    if (entry.type !== "TypeError") {
        return false;
    }

    if (
        typeof entry.value !== "string" ||
        !entry.value.includes(CAPACITOR_WEBKIT_HANDLER_MESSAGE)
    ) {
        return false;
    }

    return hasCapacitorBridgeFrame(entry);
}

function isCapacitorBridgeTeardownNoise(event: CaptureResult): boolean {
    if (event.event !== "$exception") {
        return false;
    }

    const exceptionList = event.properties?.$exception_list;
    if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
        return false;
    }

    // Only drop when EVERY entry is the benign Capacitor teardown throw, so an
    // event chaining it with a genuine exception keeps its actionable detail.
    return exceptionList.every(isCapacitorTeardownException);
}

function beforeSend(result: CaptureResult | null): CaptureResult | null {
    const filteredResult = dropScriptErrorNoise(result);
    if (!filteredResult) {
        return null;
    }

    if (isRrwebCrossOriginIframeException(filteredResult)) {
        return null;
    }

    if (isCapacitorBridgeTeardownNoise(filteredResult)) {
        return null;
    }

    return filteredResult;
}

export function getPostHogClientConfig(): Partial<PostHogConfig> {
    const posthogHost = getPostHogHost();
    const apiHost = getPostHogProxyPath() ?? posthogHost;
    const uiHost = getPostHogUiHost(posthogHost);

    return {
        api_host: apiHost,
        ...(uiHost ? { ui_host: uiHost } : {}),
        defaults: "2026-01-30",
        capture_exceptions: true,
        capture_pageleave: true,
        capture_pageview: "history_change",
        person_profiles: "identified_only",
        before_send: beforeSend,
    };
}
