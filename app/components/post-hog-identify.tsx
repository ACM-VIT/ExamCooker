"use client";

import { useEffect, useRef } from "react";
import {
    identifyPostHogUser,
    resetPostHogUser,
} from "@/lib/posthog/client";

function scheduleIdleWork(callback: () => void) {
    if ("requestIdleCallback" in window) {
        const id = window.requestIdleCallback(callback, { timeout: 3500 });
        return () => window.cancelIdleCallback(id);
    }

    const id = globalThis.setTimeout(callback, 2500);
    return () => globalThis.clearTimeout(id);
}

export default function PostHogIdentify() {
    const lastIdentifiedUserId = useRef<string | null>(null);
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    useEffect(() => {
        if (!posthogKey) return;

        let cancelled = false;
        let cancelInitialSync: (() => void) | null = null;

        async function syncIdentity() {
            try {
                const { getSession } = await import("next-auth/react");
                const session = await getSession();
                if (cancelled) return;

                if (session?.user?.id) {
                    identifyPostHogUser({
                        id: session.user.id,
                        email: session.user.email,
                        name: session.user.name,
                        role: session.user.role,
                    });
                    lastIdentifiedUserId.current = session.user.id;
                    return;
                }
            } catch {
                if (cancelled) return;
            }

            if (lastIdentifiedUserId.current !== null) {
                resetPostHogUser();
                lastIdentifiedUserId.current = null;
            }
        }

        cancelInitialSync = scheduleIdleWork(() => {
            void syncIdentity();
        });
        window.addEventListener("focus", syncIdentity);

        return () => {
            cancelled = true;
            cancelInitialSync?.();
            window.removeEventListener("focus", syncIdentity);
        };
    }, [posthogKey]);

    return null;
}
