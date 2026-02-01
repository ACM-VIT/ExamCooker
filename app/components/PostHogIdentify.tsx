"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";

export default function PostHogIdentify() {
    const { data: session, status } = useSession();
    const hasIdentified = useRef(false);
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

    useEffect(() => {
        if (!posthogKey) return;

        if (status === "authenticated" && session?.user?.id) {
            posthog.identify(session.user.id, {
                email: session.user.email ?? undefined,
                name: session.user.name ?? undefined,
                role: session.user.role ?? undefined,
            });
            hasIdentified.current = true;
            return;
        }

        if (status === "unauthenticated" && hasIdentified.current) {
            posthog.reset();
            hasIdentified.current = false;
        }
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
