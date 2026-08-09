"use client";

import React, { type ReactNode } from "react";
import type { ViewTransitionClass } from "react";

type OptionalViewTransitionProps = {
  children: ReactNode;
  default?: string;
  enter?: string | ViewTransitionClass;
  exit?: string | ViewTransitionClass;
  name?: string;
  update?: string | ViewTransitionClass;
};

type ReactTransitionExports = typeof React & {
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
  addTransitionType?: (transitionType: string) => void;
};

const reactTransitions = React as ReactTransitionExports;

export function addReactTransitionType(transitionType: string) {
  reactTransitions.addTransitionType?.(transitionType);
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = reactTransitions.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
