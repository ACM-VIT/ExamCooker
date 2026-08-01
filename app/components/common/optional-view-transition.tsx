"use client";

import React from "react";
import type { ViewTransitionProps } from "react";

type ReactWithViewTransition = typeof React & {
    ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

export default function OptionalViewTransition({
    children,
    ...props
}: ViewTransitionProps & { children: React.ReactNode }) {
    const ViewTransition = (React as ReactWithViewTransition).ViewTransition;
    if (typeof ViewTransition !== "function") {
        return <>{children}</>;
    }

    return <ViewTransition {...props}>{children}</ViewTransition>;
}
