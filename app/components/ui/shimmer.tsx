"use client";

// Ported from the AI SDK Elements "Shimmer" (elements.ai-sdk.dev) via
// Projects/conclave, reimplemented with a CSS keyframe animation (`.ec-shimmer`
// in globals.css) so it needs no motion dependency: a faint base text with a
// brighter highlight band sweeping across, themed to the ExamCooker palette.

import {
  createElement,
  memo,
  type CSSProperties,
  type ElementType,
} from "react";

export type ShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

function ShimmerComponent({
  children,
  as = "span",
  className,
  duration = 2,
  spread = 2,
}: ShimmerProps) {
  const dynamicSpread = (children?.length ?? 0) * spread;
  return createElement(
    as,
    {
      className: className ? `ec-shimmer ${className}` : "ec-shimmer",
      style: {
        "--ec-shimmer-spread": `${dynamicSpread}px`,
        "--ec-shimmer-duration": `${duration}s`,
      } as CSSProperties,
    },
    children,
  );
}

export const Shimmer = memo(ShimmerComponent);
export default Shimmer;
