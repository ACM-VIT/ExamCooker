"use client";

import React from "react";

type ReactViewTransition = NonNullable<typeof React.ViewTransition>;
type OptionalViewTransitionProps = React.ComponentProps<ReactViewTransition>;

export function OptionalViewTransition({
    children,
    ...props
}: OptionalViewTransitionProps) {
    const ViewTransition = React.ViewTransition;

    if (typeof ViewTransition !== "function") {
        return <>{children}</>;
    }

    return <ViewTransition {...props}>{children}</ViewTransition>;
}
