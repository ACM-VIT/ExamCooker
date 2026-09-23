"use client";

import * as React from "react";
import type { ViewTransitionClass } from "react";

type OptionalViewTransitionProps = {
  children: React.ReactNode;
  name?: string;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
  share?: ViewTransitionClass;
  default?: string;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<OptionalViewTransitionProps>;
};

const ReactRuntime = React as ReactTransitionRuntime;

export function addOptionalTransitionType(type: string) {
  if (typeof ReactRuntime.addTransitionType === "function") {
    ReactRuntime.addTransitionType(type);
  }
}

export function OptionalViewTransition(props: OptionalViewTransitionProps) {
  const ViewTransition = ReactRuntime.ViewTransition;

  if (!ViewTransition) {
    return <>{props.children}</>;
  }

  return <ViewTransition {...props} />;
}
