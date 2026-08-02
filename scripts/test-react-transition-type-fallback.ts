import * as assert from "node:assert/strict";
import React from "react";
import { installReactTransitionTypeFallback } from "@/lib/react-transition-types";

type ReactWithTransitionTypes = typeof React & {
  addTransitionType?: (transitionType: string) => void;
};

const reactWithTransitionTypes = React as ReactWithTransitionTypes;
const initialAddTransitionType = reactWithTransitionTypes.addTransitionType;

assert.notEqual(
  typeof initialAddTransitionType,
  "function",
  "This regression test should be revisited once React ships addTransitionType.",
);

const installResult = installReactTransitionTypeFallback();

assert.equal(installResult, "fallback");
assert.equal(typeof reactWithTransitionTypes.addTransitionType, "function");
assert.doesNotThrow(() => {
  reactWithTransitionTypes.addTransitionType?.("nav-forward");
});

console.log("React transition type fallback is installed and callable.");
