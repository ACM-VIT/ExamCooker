"use client";

import React from "react";
import type { ReactNode } from "react";
import type { ViewTransitionClass } from "react";

type ViewTransitionProps = {
    children?: ReactNode;
    name?: string;
    enter?: ViewTransitionClass | string;
    exit?: ViewTransitionClass | string;
    update?: ViewTransitionClass | string;
    share?: ViewTransitionClass | string;
    default?: ViewTransitionClass | string;
};

type ReactTransitionRuntime = typeof React & {
    addTransitionType?: (type: string) => void;
    ViewTransition?: React.ElementType<ViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addTransitionType(type: string) {
    if (typeof reactTransitionRuntime.addTransitionType === "function") {
        reactTransitionRuntime.addTransitionType(type);
    }
}

export function OptionalViewTransition({
    children,
    ...props
}: ViewTransitionProps) {
    const ViewTransition = reactTransitionRuntime.ViewTransition;

    if (!ViewTransition) {
        return <>{children}</>;
    }

    return React.createElement(ViewTransition, props, children);
}
