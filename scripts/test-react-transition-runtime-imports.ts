import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addTransitionType, OptionalViewTransition } from "../app/components/common/react-transition";

const unsafeImportPattern =
  /import\s+(?:React,\s*)?\{[^}]*\b(?:addTransitionType|ViewTransition)\b[^}]*\}\s+from\s+["']react["']/;

const filesToCheck = [
  "app/(app)/home/course-search.tsx",
  "app/components/command-palette.tsx",
  "app/components/common/directional-transition.tsx",
  "app/components/mobile-tab-bar.tsx",
  "app/components/nav-bar.tsx",
  "app/components/notes/notes-course-search.tsx",
  "app/components/past_papers/answer-key-toggle.tsx",
  "app/components/past_papers/course-paper-grid.tsx",
  "app/components/past_papers/filter-bar.tsx",
  "app/components/past_papers/past-papers-course-search.tsx",
  "app/components/past_papers/sort-dropdown.tsx",
  "app/components/voice/voice-agent-provider.tsx",
];

const reactRuntime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const unsafeFiles = filesToCheck.filter((file) => {
  const contents = readFileSync(join(process.cwd(), file), "utf8");
  return unsafeImportPattern.test(contents);
});

if (unsafeFiles.length > 0) {
  throw new Error(
    `Unsafe React transition runtime imports remain:\n${unsafeFiles.join("\n")}`,
  );
}

addTransitionType("nav-forward");

const html = renderToStaticMarkup(
  React.createElement(
    OptionalViewTransition,
    { enter: "nav-forward", default: "none" },
    React.createElement("span", null, "fallback-ok"),
  ),
);

if (html !== "<span>fallback-ok</span>") {
  throw new Error(`Unexpected fallback render output: ${html}`);
}

console.log(
  [
    `react.addTransitionType=${typeof reactRuntime.addTransitionType}`,
    `react.ViewTransition=${typeof reactRuntime.ViewTransition}`,
    `checkedFiles=${filesToCheck.length}`,
    "fallbackRender=ok",
  ].join("\n"),
);
