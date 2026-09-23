"use client";

import React from "react";
import type { ReactNode } from "react";

type ViewTransitionClassValue = "none" | "auto" | (string & {});

export type ViewTransitionClass =
  | ViewTransitionClassValue
  | Record<"default" | (string & {}), ViewTransitionClassValue>;

type OptionalViewTransitionProps = {
  children?: ReactNode;
  default?: ViewTransitionClass;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  name?: string;
  share?: ViewTransitionClass;
  update?: ViewTransitionClass;
};

type ReactTransitionRuntime = {
  addTransitionType?: (transitionType: string) => void;
  ViewTransition?: unknown;
};

const reactTransitionRuntime = React as unknown as ReactTransitionRuntime;

export function addOptionalTransitionType(transitionType: string) {
  const addTransitionType = reactTransitionRuntime.addTransitionType;

  if (typeof addTransitionType === "function") {
    addTransitionType(transitionType);
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

  return React.createElement(
    ViewTransition as React.ElementType<OptionalViewTransitionProps>,
    props,
    children,
  );
}
