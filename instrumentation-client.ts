import posthog from "posthog-js";
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
