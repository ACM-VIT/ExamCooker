"use client";

import React, { ViewTransition } from "react";
import { usePathname } from "next/navigation";

export default function DirectionalTransition({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <ViewTransition
            key={pathname}
            enter={{
                "nav-forward": "nav-forward",
                "nav-back": "nav-back",
                "nav-lateral": "nav-lateral-enter",
                default: "none",
            }}
            exit={{
                "nav-forward": "nav-forward",
                "nav-back": "nav-back",
                "nav-lateral": "nav-lateral-exit",
                default: "none",
            }}
            default="none"
        >
            {children}
        </ViewTransition>
    );
}
