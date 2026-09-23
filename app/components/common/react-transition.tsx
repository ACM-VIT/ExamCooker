"use client";

import React, {
  type ReactNode,
  type ViewTransitionClass,
  type ViewTransitionProps,
} from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export type { ViewTransitionClass };

export function addOptionalTransitionType(type: string) {
  reactTransitionRuntime.addTransitionType?.(type);
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps & { children: ReactNode }) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
