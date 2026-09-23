"use client";

import React, { type ReactNode } from "react";
import type { ViewTransitionClass } from "react";

type OptionalViewTransitionProps = {
  children: ReactNode;
  default?: string | ViewTransitionClass;
  enter?: string | ViewTransitionClass;
  exit?: string | ViewTransitionClass;
  name?: string;
  share?: string | ViewTransitionClass;
  update?: string | ViewTransitionClass;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
};

export type { ViewTransitionClass };

export function addOptionalTransitionType(transitionType: string) {
  const addTransitionType = (React as ReactTransitionRuntime).addTransitionType;

  if (typeof addTransitionType === "function") {
    addTransitionType(transitionType);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = (React as ReactTransitionRuntime).ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
