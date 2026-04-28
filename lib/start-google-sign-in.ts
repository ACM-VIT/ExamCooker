"use client";

import { signIn } from "next-auth/react";

function getDefaultCallbackUrl() {
    if (typeof window === "undefined") {
        return "/";
    }

    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function startGoogleSignIn(callbackUrl?: string) {
    const redirectTarget =
        typeof callbackUrl === "string" && callbackUrl.trim().length > 0
            ? callbackUrl
            : getDefaultCallbackUrl();

    void signIn("google", { callbackUrl: redirectTarget });
}
