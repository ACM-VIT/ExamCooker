import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const proxyPath = process.env.NEXT_PUBLIC_POSTHOG_PROXY_PATH;
const normalizedProxyPath =
    proxyPath && proxyPath.startsWith("/") ? proxyPath : proxyPath ? `/${proxyPath}` : null;
const apiHost = normalizedProxyPath ?? process.env.NEXT_PUBLIC_POSTHOG_HOST;
const configuredUiHost = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST;
const inferredUiHost = (() => {
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "";
    if (host.includes("eu.i.posthog.com")) return "https://eu.posthog.com";
    if (host.includes("us.i.posthog.com")) return "https://us.posthog.com";
    return undefined;
})();
const uiHost = configuredUiHost ?? inferredUiHost;

if (typeof window !== "undefined" && posthogKey) {
    posthog.init(posthogKey, {
        api_host: apiHost,
        ...(uiHost ? { ui_host: uiHost } : {}),
        defaults: "2025-11-30",
        capture_pageview: "history_change",
    });
}
