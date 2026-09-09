import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";

const repoRoot = process.cwd();
const searchRoots = ["app", "lib"].map((root) => join(repoRoot, root));
const safeWrapperPath = join(
  repoRoot,
  "app/components/common/react-transition.tsx",
);

const reactRuntime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const unsafeNamedReactImportPattern =
  /import\s+(?:type\s+)?(?:[\w*\s{},]*,\s*)?\{[\s\S]*?\b(?:addTransitionType|ViewTransition)\b[\s\S]*?\}\s+from\s+["']react["']/g;
const viewTransitionJsxPattern = /<\/?ViewTransition(?:\s|>)/g;

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
}

function walk(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      files.push(...walk(path));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

const failures: string[] = [];

for (const file of searchRoots.flatMap(walk)) {
  if (file === safeWrapperPath) continue;

  const source = stripComments(readFileSync(file, "utf8"));
  const displayPath = relative(repoRoot, file);

  if (unsafeNamedReactImportPattern.test(source)) {
    failures.push(`${displayPath}: imports unavailable transition APIs from react`);
  }

  if (viewTransitionJsxPattern.test(source)) {
    failures.push(`${displayPath}: renders <ViewTransition> outside OptionalViewTransition`);
  }

  unsafeNamedReactImportPattern.lastIndex = 0;
  viewTransitionJsxPattern.lastIndex = 0;
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `React runtime exports: addTransitionType=${typeof reactRuntime.addTransitionType} ViewTransition=${typeof reactRuntime.ViewTransition}`,
);
console.log("No unsafe React transition runtime imports found.");
