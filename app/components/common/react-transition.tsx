"use client";

import React from "react";
import type { ViewTransitionClass, ViewTransitionProps } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ExoticComponent<ViewTransitionProps>;
};

const reactTransitions = React as ReactTransitionRuntime;

export type { ViewTransitionClass };

export function addOptionalTransitionType(type: string) {
  const addTransitionType = reactTransitions.addTransitionType;
  if (typeof addTransitionType === "function") {
    addTransitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = reactTransitions.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
