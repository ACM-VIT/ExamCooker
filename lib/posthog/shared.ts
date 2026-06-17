import type { CaptureResult, PostHogConfig } from "posthog-js";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

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
            return (
                filename.includes("posthog-recorder") ||
                filename.includes("rrweb")
            );
        });
    });
}

function beforeSend(result: CaptureResult | null): CaptureResult | null {
    if (result && isRrwebCrossOriginIframeException(result)) {
        return null;
    }
    return result;
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
