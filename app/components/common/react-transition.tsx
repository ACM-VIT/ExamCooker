"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type OptionalViewTransitionProps = {
  children: React.ReactNode;
  name?: string;
  enter?: string | ViewTransitionClass;
  exit?: string | ViewTransitionClass;
  update?: string | ViewTransitionClass;
  share?: string | ViewTransitionClass;
  default?: string;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addTransitionType(transitionType: string) {
  reactTransitionRuntime.addTransitionType?.(transitionType);
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}

export type { ViewTransitionClass };
