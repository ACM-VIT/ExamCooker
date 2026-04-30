"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { captureUserSignedOut } from "@/lib/posthog/client";

export function SignOut({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const handleSignOut = () => {
        captureUserSignedOut();
        void signOut({ callbackUrl: "/" });
    };

    return (
        <button type="button" onClick={handleSignOut}>
            {children}
        </button>
    );
}
