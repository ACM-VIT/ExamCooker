"use client";

import * as React from "react";
import type { ViewTransitionClass } from "react";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
};

type OptionalViewTransitionProps = {
  children: React.ReactNode;
  name?: string;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
  share?: ViewTransitionClass | string;
  default?: string;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addTransitionType(type: string) {
  reactTransitionRuntime.addTransitionType?.(type);
}

export function OptionalViewTransition(props: OptionalViewTransitionProps) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{props.children}</>;
  }

  return <ViewTransition {...props} />;
}
