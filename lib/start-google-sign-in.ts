"use client";

import { signIn } from "next-auth/react";
import { captureSignInStarted } from "@/lib/posthog/client";

type AuthProvider = "apple" | "google";

function getDefaultCallbackUrl() {
    if (typeof window === "undefined") {
        return "/";
    }

    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function startProviderSignIn(
    provider: AuthProvider,
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
    void signIn(provider, { callbackUrl: redirectTarget });
}

export function startGoogleSignIn(
    callbackUrl?: string,
    options?: {
        source?: string;
    },
) {
    startProviderSignIn("google", callbackUrl, options);
}

export function startAppleSignIn(
    callbackUrl?: string,
    options?: {
        source?: string;
    },
) {
    startProviderSignIn("apple", callbackUrl, options);
}
