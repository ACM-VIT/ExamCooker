"use client";

import React from "react";
import type { ViewTransitionClass, ViewTransitionProps } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ElementType<ViewTransitionProps>;
};

const transitionRuntime = React as ReactTransitionRuntime;

export type { ViewTransitionClass };

export function addTransitionType(type: string) {
  const addTransition = transitionRuntime.addTransitionType;

  if (typeof addTransition === "function") {
    addTransition(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = transitionRuntime.ViewTransition;

  if (ViewTransition) {
    return <ViewTransition {...props}>{children}</ViewTransition>;
  }

  return <>{children}</>;
}
