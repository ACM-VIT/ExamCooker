import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";

const root = process.cwd();
const appDir = join(root, "app");
const allowedViewTransitionElementFile = "app/components/common/react-transition.tsx";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function hasUnsafeReactTransitionImport(source: string) {
  const importPattern = /import\s+(?!type\b)(?:React\s*,\s*)?\{([^}]*)\}\s+from\s+["']react["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source))) {
    const names = match[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);

    if (names.includes("addTransitionType") || names.includes("ViewTransition")) {
      return true;
    }
  }

  return false;
}

function hasUnsafeViewTransitionElement(source: string, relativePath: string) {
  if (relativePath === allowedViewTransitionElementFile) return false;
  return source
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .some((line) => /<ViewTransition[\s>]/.test(line) || /<\/ViewTransition>/.test(line));
}

const runtime = React as ReactTransitionRuntime;
console.log(
  `react runtime exports: addTransitionType=${typeof runtime.addTransitionType} ViewTransition=${typeof runtime.ViewTransition}`,
);

const failures: string[] = [];
for (const file of walk(appDir)) {
  const relativePath = relative(root, file);
  const source = readFileSync(file, "utf8");

  if (hasUnsafeReactTransitionImport(source)) {
    failures.push(`${relativePath}: imports experimental React transition runtime APIs directly`);
  }

  if (hasUnsafeViewTransitionElement(source, relativePath)) {
    failures.push(`${relativePath}: renders <ViewTransition> directly instead of OptionalViewTransition`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
