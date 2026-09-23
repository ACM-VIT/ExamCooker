"use client";

import * as React from "react";
import type { ReactNode, ViewTransitionProps } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addOptionalTransitionType(type: string) {
  reactTransitionRuntime.addTransitionType?.(type);
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps & { children: ReactNode }) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
