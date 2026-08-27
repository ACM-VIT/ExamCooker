import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
  Activity?: unknown;
};

const repoRoot = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "drizzle",
]);
const allowedReactTransitionFile = path.join(
  repoRoot,
  "app/components/common/react-transition.tsx",
);
const thisTestFile = path.join(repoRoot, "scripts/test-react-transition-runtime-imports.ts");

type UnsafeReference = {
  file: string;
  detail: string;
};

function walk(directory: string, files: string[] = []) {
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        walk(fullPath, files);
      }
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findUnsafeTransitionReferences(filePath: string): UnsafeReference[] {
  if (filePath === allowedReactTransitionFile || filePath === thisTestFile) {
    return [];
  }

  const source = readFileSync(filePath, "utf8");
  const unsafe: UnsafeReference[] = [];
  const runtimeReactImportPattern = /import\s+(?!type\b)[\s\S]*?\bfrom\s+["']react["'];?/g;
  const runtimeReactImports = source.match(runtimeReactImportPattern) ?? [];

  for (const importStatement of runtimeReactImports) {
    if (/\b(addTransitionType|ViewTransition)\b/.test(importStatement)) {
      unsafe.push({
        file: path.relative(repoRoot, filePath),
        detail: importStatement.replace(/\s+/g, " ").trim(),
      });
    }
  }

  if (/\bReact\.(addTransitionType|ViewTransition)\b/.test(source)) {
    unsafe.push({
      file: path.relative(repoRoot, filePath),
      detail: "Direct React.addTransitionType/React.ViewTransition access",
    });
  }

  return unsafe;
}

const unsafeReferences = walk(repoRoot).flatMap(findUnsafeTransitionReferences);

console.log(
  [
    `react.addTransitionType=${typeof react.addTransitionType}`,
    `react.ViewTransition=${typeof react.ViewTransition}`,
    `react.Activity=${typeof react.Activity}`,
  ].join(" "),
);

if (unsafeReferences.length > 0) {
  console.error("Unsafe React transition runtime references found:");
  for (const reference of unsafeReferences) {
    console.error(`- ${reference.file}: ${reference.detail}`);
  }
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
