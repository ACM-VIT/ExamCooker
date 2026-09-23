"use client";

import React from "react";
import type { ViewTransitionClass } from "react";

type OptionalViewTransitionProps = {
  children: React.ReactNode;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  update?: ViewTransitionClass;
  share?: ViewTransitionClass;
  default?: string;
  name?: string;
};

type ReactTransitionExports = typeof React & {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: React.ElementType<OptionalViewTransitionProps>;
};

const transitionExports = React as ReactTransitionExports;

export function addTransitionType(transitionType: string) {
  transitionExports.addTransitionType?.(transitionType);
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  const ViewTransition = transitionExports.ViewTransition;

  if (!ViewTransition) {
    return <>{children}</>;
  }

  return <ViewTransition {...props}>{children}</ViewTransition>;
}

export type { ViewTransitionClass };
