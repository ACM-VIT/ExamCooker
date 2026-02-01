import { PostHog } from "posthog-node";

const posthogApiKey =
    process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost =
    process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST;

export function createPostHogServer() {
    if (!posthogApiKey) return null;

    const config = {
        ...(posthogHost ? { host: posthogHost } : {}),
        flushAt: 1,
        flushInterval: 0,
    };

    return new PostHog(posthogApiKey, config);
}
