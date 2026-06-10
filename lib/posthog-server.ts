import { PostHog } from "posthog-node";
import { getPostHogHost, getPostHogProjectKey } from "@/lib/posthog/shared";

const posthogApiKey =
    process.env.POSTHOG_API_KEY || getPostHogProjectKey();
const posthogHost = getPostHogHost();

export function createPostHogServer() {
    if (!posthogApiKey) return null;

    const config = {
        ...(posthogHost ? { host: posthogHost } : {}),
        flushAt: 1,
        flushInterval: 0,
    };

    return new PostHog(posthogApiKey, config);
}
