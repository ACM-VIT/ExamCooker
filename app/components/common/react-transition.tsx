"use client";

import React from "react";
import type { ReactNode, ViewTransitionClass } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ElementType;
};

type OptionalViewTransitionProps = {
  children: ReactNode;
  default?: string;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  name?: string;
  update?: ViewTransitionClass;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addOptionalTransitionType(type: string) {
  const addTransitionType = reactTransitionRuntime.addTransitionType;

  if (typeof addTransitionType === "function") {
    addTransitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
