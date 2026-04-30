"use client";

import { signIn } from "next-auth/react";
import { captureSignInStarted } from "@/lib/posthog/client";

function getDefaultCallbackUrl() {
    if (typeof window === "undefined") {
        return "/";
    }

    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function startGoogleSignIn(
    callbackUrl?: string,
    options?: {
        source?: string;
    },
) {
    const redirectTarget =
        typeof callbackUrl === "string" && callbackUrl.trim().length > 0
            ? callbackUrl
            : getDefaultCallbackUrl();

    captureSignInStarted({
        source: options?.source ?? "unknown",
        callbackPath: redirectTarget,
    });
    void signIn("google", { callbackUrl: redirectTarget });
}
