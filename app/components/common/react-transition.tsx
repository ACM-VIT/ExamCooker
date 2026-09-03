"use client";

import React from "react";
import type { ReactNode, ViewTransitionClass } from "react";

type ViewTransitionProps = {
  children: ReactNode;
  default?: string;
  enter?: string | ViewTransitionClass;
  exit?: string | ViewTransitionClass;
  name?: string;
  share?: string | ViewTransitionClass;
  update?: string | ViewTransitionClass;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export type { ViewTransitionClass };

export function safeAddTransitionType(type: string) {
  if (typeof reactTransitionRuntime.addTransitionType === "function") {
    reactTransitionRuntime.addTransitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = reactTransitionRuntime.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
