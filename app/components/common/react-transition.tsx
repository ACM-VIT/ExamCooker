"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type ViewTransitionProps = {
  children: React.ReactNode;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
  default?: string;
  name?: string;
};

type ReactTransitionExports = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType<ViewTransitionProps>;
};

const reactWithTransitionExports = React as ReactTransitionExports;

export function addTransitionType(type: string) {
  const addTransitionType = reactWithTransitionExports.addTransitionType;

  if (typeof addTransitionType === "function") {
    addTransitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: ViewTransitionProps) {
  const ViewTransition = reactWithTransitionExports.ViewTransition;

  if (typeof ViewTransition !== "function") {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}
