"use client";

import { useEffect, useRef } from "react";
import { getSession } from "next-auth/react";
import posthog from "posthog-js";

export default function PostHogIdentify() {
    const lastIdentifiedUserId = useRef<string | null>(null);
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    useEffect(() => {
        if (!posthogKey) return;

        let cancelled = false;

        async function syncIdentity() {
            try {
                const session = await getSession();
                if (cancelled) return;

                if (session?.user?.id) {
                    posthog.identify(session.user.id, {
                        email: session.user.email ?? undefined,
                        name: session.user.name ?? undefined,
                        role: session.user.role ?? undefined,
                    });
                    lastIdentifiedUserId.current = session.user.id;
                    return;
                }
            } catch {
                if (cancelled) return;
            }

            if (lastIdentifiedUserId.current !== null) {
                posthog.reset();
                lastIdentifiedUserId.current = null;
            }
        }

        void syncIdentity();
        window.addEventListener("focus", syncIdentity);

        return () => {
            cancelled = true;
            window.removeEventListener("focus", syncIdentity);
        };
    }, [posthogKey]);

    return null;
}
