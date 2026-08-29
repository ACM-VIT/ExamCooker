"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type ReactWithTransitions = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

type ViewTransitionProps = {
  children: React.ReactNode;
  default?: string;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  name?: string;
  share?: ViewTransitionClass;
  update?: ViewTransitionClass;
};

export function addTransitionType(type: string) {
  const transitionType = (React as ReactWithTransitions).addTransitionType;
  if (typeof transitionType === "function") {
    transitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = (React as ReactWithTransitions).ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
