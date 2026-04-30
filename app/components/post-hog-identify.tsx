"use client";

import { useEffect, useRef } from "react";
import { getSession } from "next-auth/react";
import {
    identifyPostHogUser,
    resetPostHogUser,
} from "@/lib/posthog/client";

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

        void syncIdentity();
        window.addEventListener("focus", syncIdentity);

        return () => {
            cancelled = true;
            window.removeEventListener("focus", syncIdentity);
        };
    }, [posthogKey]);

    return null;
}
