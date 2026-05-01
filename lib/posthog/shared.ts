import type { PostHogConfig } from "posthog-js";

const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

function readEnv(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export const POSTHOG_FEATURE_FLAGS = {
    voiceAgent: "voice-agent-enabled",
} as const;

export function getPostHogProjectKey() {
    return readEnv(process.env.NEXT_PUBLIC_POSTHOG_KEY);
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
        defaults: "2025-11-30",
        capture_exceptions: true,
        capture_pageleave: true,
        capture_pageview: "history_change",
        person_profiles: "identified_only",
    };
}
