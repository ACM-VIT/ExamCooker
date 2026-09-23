"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type ReactTransitionRuntime = typeof React & {
    ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
    addTransitionType?: (type: string) => void;
};

type OptionalViewTransitionProps = {
    children: React.ReactNode;
    enter?: ViewTransitionClass;
    exit?: ViewTransitionClass;
    update?: ViewTransitionClass;
    default?: string;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addReactTransitionType(type: string) {
    reactTransitionRuntime.addTransitionType?.(type);
}

export function OptionalViewTransition({
    children,
    ...props
}: OptionalViewTransitionProps) {
    const ViewTransition = reactTransitionRuntime.ViewTransition;

    if (!ViewTransition) {
        return <>{children}</>;
    }

    return <ViewTransition {...props}>{children}</ViewTransition>;
}
