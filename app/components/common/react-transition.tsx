"use client";

import React from "react";
import type { ViewTransitionProps } from "react";

type ReactTransitionExports = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ExoticComponent<ViewTransitionProps>;
};

const ReactTransitions = React as ReactTransitionExports;

export function addOptionalTransitionType(type: string) {
  if (typeof ReactTransitions.addTransitionType !== "function") {
    return;
  }

  ReactTransitions.addTransitionType(type);
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = ReactTransitions.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
