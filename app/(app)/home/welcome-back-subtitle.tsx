"use client";

import type { ReactNode } from "react";

type Props = {
    className?: string;
    children: ReactNode;
};

export default function WelcomeBackSubtitle({ className, children }: Props) {
    return (
        <p
            className={`${className ?? ""} motion-safe:animate-[subtitleSwap_420ms_cubic-bezier(0.22,1,0.36,1)_both]`}
        >
            {children}
        </p>
    );
}
