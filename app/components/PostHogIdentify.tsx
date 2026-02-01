"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

export default function PostHogIdentify() {
    const { data: session, status } = useSession();
    const lastStatus = useRef<string | null>(null);
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    useEffect(() => {
        if (!posthogKey) return;

        if (status === "authenticated" && session?.user?.id) {
            posthog.identify(session.user.id, {
                email: session.user.email ?? undefined,
                name: session.user.name ?? undefined,
                role: session.user.role ?? undefined,
            });
            lastStatus.current = "authenticated";
            return;
        }

        if (status === "unauthenticated") {
            if (lastStatus.current !== "unauthenticated") {
                posthog.reset();
            }
            lastStatus.current = "unauthenticated";
            return;
        }

        lastStatus.current = status;
    }, [
        posthogKey,
        status,
        session?.user?.id,
        session?.user?.email,
        session?.user?.name,
        session?.user?.role,
    ]);

    return null;
}
