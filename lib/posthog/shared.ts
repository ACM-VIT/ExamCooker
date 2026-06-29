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

function isUnactionableEntry(exception: unknown): boolean {
    return (
        isUnactionableScriptError(exception) ||
        isUnactionableExtensionRejection(exception)
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
        before_send: dropScriptErrorNoise,
    };
}
