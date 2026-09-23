"use client";

import React, { type ReactNode } from "react";
import type { ViewTransitionProps } from "react";

type OptionalViewTransitionProps = ViewTransitionProps & {
  children: ReactNode;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addOptionalTransitionType(transitionType: string) {
  if (typeof reactTransitionRuntime.addTransitionType === "function") {
    reactTransitionRuntime.addTransitionType(transitionType);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
