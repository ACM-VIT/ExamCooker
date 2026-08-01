import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OptionalViewTransition from "@/app/components/common/optional-view-transition";
import { addReactTransitionType } from "@/lib/react-transition-types";

const reactWithTransitions = React as typeof React & {
  ViewTransition?: unknown;
  addTransitionType?: unknown;
};

if (reactWithTransitions.ViewTransition !== undefined) {
  throw new Error("Test expects React.ViewTransition to be absent in this runtime.");
}

if (reactWithTransitions.addTransitionType !== undefined) {
  throw new Error("Test expects React.addTransitionType to be absent in this runtime.");
}

addReactTransitionType("nav-forward");

const markup = renderToStaticMarkup(
  <OptionalViewTransition default="none">
    <span>fallback children</span>
  </OptionalViewTransition>,
);

if (markup !== "<span>fallback children</span>") {
  throw new Error(`Unexpected OptionalViewTransition fallback markup: ${markup}`);
}

console.log("react transition compatibility tests passed");
