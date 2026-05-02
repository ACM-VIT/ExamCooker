"use client";

import React from "react";
import { captureUserSignedOut } from "@/lib/posthog/client";

export function SignOut({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const handleSignOut = () => {
        captureUserSignedOut();
        void import("next-auth/react").then(({ signOut }) => {
            void signOut({ callbackUrl: "/" });
        });
    };

    return (
        <button type="button" onClick={handleSignOut}>
            {children}
        </button>
    );
}
