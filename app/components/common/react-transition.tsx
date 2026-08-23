"use client";

import React from "react";
import type { ViewTransitionProps } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ElementType<ViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;
const RuntimeViewTransition = reactTransitionRuntime.ViewTransition;

export type { ViewTransitionClass } from "react";

export function addTransitionType(type: string) {
  reactTransitionRuntime.addTransitionType?.(type);
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  if (!RuntimeViewTransition) {
    return <>{children}</>;
  }

  const ViewTransition = RuntimeViewTransition;
  return <ViewTransition {...props}>{children}</ViewTransition>;
}
