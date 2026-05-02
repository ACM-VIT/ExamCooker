"use client";

import React from "react";
import { invalidateAuthSessionCache } from "@/app/components/auth-gate";
import { captureUserSignedOut } from "@/lib/posthog/client";

export function SignOut({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const handleSignOut = () => {
        captureUserSignedOut();
        invalidateAuthSessionCache();
        void import("next-auth/react").then(({ signOut }) => {
            void signOut({ callbackUrl: "/" }).finally(() => {
                invalidateAuthSessionCache();
            });
        });
    };

    return (
        <button type="button" onClick={handleSignOut}>
            {children}
        </button>
    );
}
