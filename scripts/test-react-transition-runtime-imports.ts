import React from "react";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  OptionalViewTransition,
  addTransitionType,
} from "@/app/components/common/react-transition";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "app");
const allowedRuntimeWrapper = path.join(
  appRoot,
  "components",
  "common",
  "react-transition.tsx",
);

async function collectTsxFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTsxFiles(entryPath);
      return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : [];
    }),
  );

  return files.flat();
}

function findUnsafeTransitionImports(source: string) {
  const importPattern = /import\s+(?!type\b)([\s\S]*?)\s+from\s+["']react["'];/g;
  const matches: string[] = [];

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? "";
    if (/\b(addTransitionType|ViewTransition)\b/.test(specifier)) {
      matches.push(match[0]);
    }
  }

  return matches;
}

async function main() {
  const reactRuntime = React as typeof React & {
    addTransitionType?: (transitionType: string) => void;
    ViewTransition?: unknown;
  };

  console.log(
    `React runtime: addTransitionType=${typeof reactRuntime.addTransitionType} ViewTransition=${typeof reactRuntime.ViewTransition} Activity=${typeof React.Activity}`,
  );

  addTransitionType("nav-forward");
  const fallback = OptionalViewTransition({ children: "child" });
  if (!React.isValidElement(fallback)) {
    throw new Error("OptionalViewTransition fallback did not return a React element.");
  }

  const violations: string[] = [];
  const files = await collectTsxFiles(appRoot);
  for (const file of files) {
    if (file === allowedRuntimeWrapper) continue;

    const source = await readFile(file, "utf8");
    const unsafeImports = findUnsafeTransitionImports(source);
    if (unsafeImports.length > 0 || /React\.(addTransitionType|ViewTransition)\b/.test(source)) {
      violations.push(path.relative(repoRoot, file));
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Unsafe React transition runtime usage found:\n${violations
        .map((file) => `- ${file}`)
        .join("\n")}`,
    );
  }

  console.log("No unsafe React transition runtime imports found.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
