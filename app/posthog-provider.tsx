"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

type PostHogClient = typeof posthog & {
    __loaded?: boolean;
};

export default function PostHogProvider() {
    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!apiKey) return;

        const client = posthog as PostHogClient;
        if (client.__loaded) return;

        client.init(apiKey, {
            api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
            capture_pageview: false,
            capture_pageleave: true,
            person_profiles: "identified_only",
        });
    }, []);

    return null;
}
