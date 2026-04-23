"use client";

import React from "react";
import { signOut } from "next-auth/react";

export function SignOut({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>
            {children}
        </button>
    );
}
