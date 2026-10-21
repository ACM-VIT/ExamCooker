import posthog from "posthog-js";
import { installPdfOpenJourneyTracking } from "@/lib/pdf/open-journey";
import { getPostHogClientConfig, getPostHogProjectKey } from "@/lib/posthog/shared";

type PostHogClient = typeof posthog & {
    __loaded?: boolean;
};

const posthogKey = getPostHogProjectKey();

if (typeof window !== "undefined" && posthogKey) {
    const client = posthog as PostHogClient;

    if (!client.__loaded) {
        client.init(posthogKey, getPostHogClientConfig());
    }
}

// Track dispatched client navigations separately from document-load RUM.
// The router calls this only after a link's cancellation/new-tab checks.
let pdfJourney: ReturnType<typeof installPdfOpenJourneyTracking> | undefined;
if (typeof window !== "undefined" && posthogKey) {
    try {
        pdfJourney = installPdfOpenJourneyTracking({
            build: process.env.NEXT_PUBLIC_APP_REVISION || "local",
            backend: process.env.NEXT_PUBLIC_HOSTING_BACKEND || "unknown",
            capture: (event, properties, immediate) => {
                posthog.capture(event, properties, immediate
                    ? { transport: "sendBeacon", send_instantly: true }
                    : undefined);
            },
        });
    } catch {
        // Unsupported monitoring APIs must never prevent app initialization.
    }
}

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
    pdfJourney?.start(url, navigationType);
}
