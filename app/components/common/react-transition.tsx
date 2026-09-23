"use client";

import React from "react";
import * as ReactRuntime from "react";

type NativeViewTransition = NonNullable<typeof ReactRuntime.ViewTransition>;
type OptionalViewTransitionProps = React.ComponentProps<NativeViewTransition>;

const RuntimeViewTransition = ReactRuntime.ViewTransition;

export function addTransitionType(type: string) {
  if (typeof ReactRuntime.addTransitionType === "function") {
    ReactRuntime.addTransitionType(type);
  }
}

export function OptionalViewTransition({
  children,
  ...props
}: OptionalViewTransitionProps) {
  if (typeof RuntimeViewTransition !== "function") {
    return <>{children}</>;
  }

  return <RuntimeViewTransition {...props}>{children}</RuntimeViewTransition>;
}
