"use client";

import React from "react";
import type { ViewTransitionProps } from "react";

type ReactWithOptionalTransitions = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ExoticComponent<ViewTransitionProps>;
};

const reactWithOptionalTransitions = React as ReactWithOptionalTransitions;

export function addOptionalTransitionType(type: string) {
  reactWithOptionalTransitions.addTransitionType?.(type);
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps & { children?: React.ReactNode }) {
  const ViewTransition = reactWithOptionalTransitions.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
