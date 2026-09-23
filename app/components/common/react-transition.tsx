"use client";

import * as React from "react";
import type {
  ComponentType,
  ReactNode,
  Ref,
  ViewTransitionClass,
  ViewTransitionInstance,
} from "react";

type OptionalViewTransitionProps = {
  children: ReactNode;
  default?: ViewTransitionClass;
  enter?: ViewTransitionClass;
  exit?: ViewTransitionClass;
  name?: string;
  onEnter?: (instance: ViewTransitionInstance, types: Array<string>) => void | (() => void);
  onExit?: (instance: ViewTransitionInstance, types: Array<string>) => void | (() => void);
  onShare?: (instance: ViewTransitionInstance, types: Array<string>) => void | (() => void);
  onUpdate?: (instance: ViewTransitionInstance, types: Array<string>) => void | (() => void);
  ref?: Ref<ViewTransitionInstance>;
  share?: ViewTransitionClass;
  update?: ViewTransitionClass;
};

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: ComponentType<OptionalViewTransitionProps>;
};

const reactTransitionRuntime = React as ReactTransitionRuntime;

export function addOptionalTransitionType(type: string) {
  reactTransitionRuntime.addTransitionType?.(type);
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
