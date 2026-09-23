import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";

const repoRoot = process.cwd();

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

const unsafeRuntimeImportPattern =
  /import\s+(?!type\b)(?:[\s\S]*?\{[\s\S]*?\b(?:addTransitionType|ViewTransition)\b[\s\S]*?\}[\s\S]*?|(?:addTransitionType|ViewTransition))\s+from\s+["']react["'];?/m;

const reactRuntime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const failures: string[] = [];

for (const file of filesToCheck) {
  const absolutePath = join(repoRoot, file);
  const source = readFileSync(absolutePath, "utf8");

  if (unsafeRuntimeImportPattern.test(source)) {
    failures.push(relative(repoRoot, absolutePath));
  }
}

console.log(
  [
    `addTransitionType=${typeof reactRuntime.addTransitionType}`,
    `ViewTransition=${typeof reactRuntime.ViewTransition}`,
    `Activity=${typeof React.Activity}`,
  ].join(" "),
);

if (failures.length > 0) {
  throw new Error(
    `Unsafe React transition runtime imports found:\n${failures
      .map((file) => `- ${file}`)
      .join("\n")}`,
  );
}

console.log("No unsafe React transition runtime imports found.");
