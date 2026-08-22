"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: React.ElementType<OptionalViewTransitionProps>;
};

type OptionalViewTransitionProps = {
  children: React.ReactNode;
  default?: string;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  name?: string;
  share?: ViewTransitionClass;
  update?: ViewTransitionClass;
};

const ReactWithTransitions = React as ReactTransitionRuntime;

export function addTransitionType(transitionType: string) {
  ReactWithTransitions.addTransitionType?.(transitionType);
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = ReactWithTransitions.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}

export type { ViewTransitionClass };
