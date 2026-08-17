"use client";

import * as React from "react";
import type { ViewTransitionProps } from "react";

type ReactTransitionExports = typeof React & {
    addTransitionType?: (type: string) => void;
    ViewTransition?: React.ExoticComponent<ViewTransitionProps>;
};

const reactTransitions = React as ReactTransitionExports;

export function addTransitionType(type: string) {
    reactTransitions.addTransitionType?.(type);
}

export function ViewTransition({ children, ...props }: ViewTransitionProps) {
    const Component = reactTransitions.ViewTransition;
    if (!Component) return <>{children}</>;

    return <Component {...props}>{children}</Component>;
}

export type { ViewTransitionClass } from "react";
