"use client";

import { useEffect } from "react";
import { initializePostHogClient } from "@/lib/posthog/client";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";

export default function PostHogBootstrap() {
    useEffect(() => {
        if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

        return scheduleIdleWork(
            () => {
                void initializePostHogClient();
            },
            { fallbackDelayMs: 800, timeoutMs: 1500 },
        );
    }, []);

    return null;
}
