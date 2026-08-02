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

// PostHog's own rrweb session recorder throws a cross-origin denial while it
// walks the cross-origin YouTube iframe embedded on past-paper pages. The iframe
// load itself is unaffected, but `capture_exceptions` reports the swallowed throw
// as an error-tracking issue. This is SDK noise, not an app bug, so drop it
// before it leaves the browser.
//
// The denial arrives with a browser-specific shape:
//   - Chromium reports a `SecurityError` DOMException.
//   - Firefox reports a plain `Error` whose message is
//     `Permission denied to access property "nodeType"` — the property rrweb's
//     serializer reads while walking the iframe's DOM.
// so we accept both `DOMException` and `Error`, but ONLY when the value (or type)
// carries a cross-origin access signature. That keeps genuine recorder-side
// DOMExceptions (AbortError, NotAllowedError, QuotaExceededError,
// InvalidStateError, ...) reaching error tracking.
//
// For recorder attribution we prefer a recorder frame on the entry, but Firefox
// reports this throw with no usable frames, so we fall back to the event-level
// `$exception_sources`, which still names the recorder bundle
// (`../../rrweb/record/dist/rrweb-record.js`). We never drop a cross-origin error
// that can't be attributed to the recorder, so a genuine `Permission denied`
// raised by our own iframe access would still surface.
const CROSS_ORIGIN_SECURITY_ERROR =
    /SecurityError|cross-origin|Permission denied to access property|Blocked a frame with origin/i;

const RRWEB_CROSS_ORIGIN_EXCEPTION_TYPES = new Set(["DOMException", "Error"]);

function isPostHogRecorderSource(source: string): boolean {
    return (
        source.includes("posthog-recorder") ||
        source.includes("lazy-recorder") ||
        source.includes("rrweb")
    );
}

function hasPostHogRecorderFrame(exception: {
    stacktrace?: { frames?: unknown[] } | null;
}): boolean {
    const frames = exception.stacktrace?.frames;
    if (!Array.isArray(frames)) return false;

    return frames.some((frame) => {
        const filename =
            frame && typeof frame === "object"
                ? (frame as { filename?: unknown }).filename
                : undefined;
        return (
            typeof filename === "string" && isPostHogRecorderSource(filename)
        );
    });
}

function isRrwebCrossOriginException(
    exception: unknown,
    eventSources: string[],
): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        type?: unknown;
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    const type = typeof entry.type === "string" ? entry.type : "";
    if (!RRWEB_CROSS_ORIGIN_EXCEPTION_TYPES.has(type)) {
        return false;
    }

    // Require the specific cross-origin signature, not just the type. The
    // browser-sanitized name can surface in either the exception value or its
    // type, so check both.
    const value = typeof entry.value === "string" ? entry.value : "";
    if (
        !CROSS_ORIGIN_SECURITY_ERROR.test(value) &&
        !CROSS_ORIGIN_SECURITY_ERROR.test(type)
    ) {
        return false;
    }

    // Attribute the throw to the recorder. A recorder frame on the entry is the
    // strongest signal; when Firefox strips the frames, fall back to the
    // event-level exception source, which still names the recorder bundle.
    return (
        hasPostHogRecorderFrame(entry) ||
        eventSources.some(isPostHogRecorderSource)
    );
}

function isRrwebCrossOriginIframeNoise(event: CaptureResult): boolean {
    if (event.event !== "$exception") {
        return false;
    }

    const exceptionList = event.properties?.$exception_list;
    if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
        return false;
    }

    const sources = event.properties?.$exception_sources;
    const eventSources = Array.isArray(sources)
        ? sources.filter(
              (source): source is string => typeof source === "string",
          )
        : [];

    // Only drop when EVERY entry is the benign recorder cross-origin throw, so an
    // event chaining it with a genuine exception keeps its actionable detail.
    return exceptionList.every((exception) =>
        isRrwebCrossOriginException(exception, eventSources),
    );
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

// The app runs View Transitions in a few spots: the persistent React
// `<ViewTransition>` that animates every route change, another in the past-paper
// grid, and the manual `document.startViewTransition()` on the dark-mode toggle.
// When a transition is initiated while the tab is hidden — e.g. a navigation that
// resolves after the user has switched away — the browser intentionally skips it
// and throws `DOMException: InvalidStateError: Skipped ViewTransition due to
// document being hidden`. Nothing breaks for the user: the underlying route or
// theme change still applies, only the animation is dropped. The declarative
// React `<ViewTransition>` sites can't be guarded at the call site (React starts
// the transition internally), so we drop this expected browser behavior here
// before it reaches error tracking as noise.
//
// Match the skip-because-hidden signature on a DOMException so a genuine
// InvalidStateError from other code still surfaces.
const VIEW_TRANSITION_HIDDEN_SIGNATURE =
    /Skipped\s+view\s*transition\b[\s\S]*\bhidden\b/i;

function isViewTransitionHiddenSkip(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as { type?: unknown; value?: unknown };

    if (entry.type !== "DOMException") {
        return false;
    }

    return (
        typeof entry.value === "string" &&
        VIEW_TRANSITION_HIDDEN_SIGNATURE.test(entry.value)
    );
}

function isViewTransitionHiddenNoise(event: CaptureResult): boolean {
    if (event.event !== "$exception") {
        return false;
    }

    const exceptionList = event.properties?.$exception_list;
    if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
        return false;
    }

    // Only drop when EVERY entry is the benign hidden-tab skip, so an event that
    // chains it with a genuine exception keeps its actionable detail.
    return exceptionList.every(isViewTransitionHiddenSkip);
}

// Firefox for iOS injects a private `__firefox__` namespace for its own user
// scripts. Its Reader Mode bootstrap dereferences that namespace at document
// scope before it has been installed, so the browser throws before any
// examcooker code runs:
//   ReferenceError: Can't find variable: __firefox__
//   TypeError: undefined is not an object (evaluating 'window.__firefox__.reader')
// posthog-js (loaded on the page) captures these as unhandled exceptions. The
// throw comes entirely from the browser's own injected script — `__firefox__`
// appears nowhere in examcooker — and the page keeps working, so it is pure
// third-party noise, not our code. Because each throw carries one document-level
// frame, the existing `hasNoFrames()`-based guards let it through.
//
// We match narrowly: EVERY exception value mentions `__firefox__` AND every
// frame is document-level — the browser's `global code` pseudo-frame, or a frame
// whose filename is the page document itself. A genuine app-code error that
// merely mentioned `__firefox__` would carry a real bundle frame and still
// surface.
const FIREFOX_IOS_NAMESPACE_SIGNATURE = /__firefox__/;
const DOCUMENT_LEVEL_FRAME_FUNCTION = "global code";

function isDocumentLevelFrame(
    frame: unknown,
    pageUrl: string | undefined,
): boolean {
    if (!frame || typeof frame !== "object") {
        return false;
    }

    const fn = (frame as { function?: unknown }).function;
    if (fn === DOCUMENT_LEVEL_FRAME_FUNCTION) {
        return true;
    }

    const filename = (frame as { filename?: unknown }).filename;
    return (
        typeof filename === "string" &&
        pageUrl !== undefined &&
        filename === pageUrl
    );
}

function isFirefoxIosReaderException(
    exception: unknown,
    pageUrl: string | undefined,
): boolean {
    if (!exception || typeof exception !== "object") {
        return false;
    }

    const entry = exception as {
        value?: unknown;
        stacktrace?: { frames?: unknown[] } | null;
    };

    if (
        typeof entry.value !== "string" ||
        !FIREFOX_IOS_NAMESPACE_SIGNATURE.test(entry.value)
    ) {
        return false;
    }

    const frames = entry.stacktrace?.frames;
    if (!Array.isArray(frames)) {
        // A sanitized/synthetic throw with no stack still fits the injected-script
        // profile once its value matches the `__firefox__` signature.
        return true;
    }

    return frames.every((frame) => isDocumentLevelFrame(frame, pageUrl));
}

function isFirefoxIosReaderNoise(event: CaptureResult): boolean {
    if (event.event !== "$exception") {
        return false;
    }

    const exceptionList = event.properties?.$exception_list;
    if (!Array.isArray(exceptionList) || exceptionList.length === 0) {
        return false;
    }

    const currentUrl = event.properties?.$current_url;
    const pageUrl = typeof currentUrl === "string" ? currentUrl : undefined;

    // Only drop when EVERY entry is the browser's injected-script throw, so an
    // event chaining it with a genuine exception keeps its actionable detail.
    return exceptionList.every((exception) =>
        isFirefoxIosReaderException(exception, pageUrl),
    );
}

function beforeSend(result: CaptureResult | null): CaptureResult | null {
    const filteredResult = dropScriptErrorNoise(result);
    if (!filteredResult) {
        return null;
    }

    if (isRrwebCrossOriginIframeNoise(filteredResult)) {
        return null;
    }

    if (isCapacitorBridgeTeardownNoise(filteredResult)) {
        return null;
    }

    if (isViewTransitionHiddenNoise(filteredResult)) {
        return null;
    }

    if (isFirefoxIosReaderNoise(filteredResult)) {
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
