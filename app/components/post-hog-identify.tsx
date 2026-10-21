"use client";

import { useEffect, useRef } from "react";
import {
    identifyPostHogUser,
    resetPostHogUser,
} from "@/lib/posthog/client";
import { scheduleIdleWork } from "@/lib/schedule-idle-work";
import { loadAuthSession } from "@/app/components/auth-gate";

export default function PostHogIdentify() {
    const lastIdentifiedUserId = useRef<string | null>(null);
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    useEffect(() => {
        if (!posthogKey) return;

        let cancelled = false;
        let cancelInitialSync: (() => void) | null = null;

        async function syncIdentity(refresh = false) {
            try {
                const session = await loadAuthSession({ refresh });
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

        cancelInitialSync = scheduleIdleWork(
            () => {
                void syncIdentity();
            },
            { fallbackDelayMs: 2500, timeoutMs: 3500 },
        );
        // Another tab may have signed in or out; re-read the session on focus.
        const syncOnFocus = () => void syncIdentity(true);
        window.addEventListener("focus", syncOnFocus);

        return () => {
            cancelled = true;
            cancelInitialSync?.();
            window.removeEventListener("focus", syncOnFocus);
        };
    }, [posthogKey]);

    return null;
}
