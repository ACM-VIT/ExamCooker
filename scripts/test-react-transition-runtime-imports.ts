import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedFiles = new Set([
  "app/components/common/react-transition.tsx",
  "scripts/test-react-transition-runtime-imports.ts",
]);
const sourceRoots = ["app", "lib"].map((root) => path.join(repoRoot, root));
const sourceExtensions = new Set([".ts", ".tsx"]);
const unsafeNames = ["addTransitionType", "ViewTransition"];
const runtime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

function toPosixRelative(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function walkSourceFiles(dir: string, files: string[] = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkSourceFiles(entryPath, files);
      continue;
    }

    if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function getUnsafeRuntimeImports(source: string) {
  const matches: string[] = [];
  const importRegex = /import\s+(?!type\b)[\s\S]*?\bfrom\s+["']react["'];?/g;

  for (const match of source.matchAll(importRegex)) {
    const statement = match[0];

    for (const name of unsafeNames) {
      const namedImportRegex = new RegExp(`[{,]\\s*${name}\\b`);
      if (namedImportRegex.test(statement)) {
        matches.push(statement.replace(/\s+/g, " ").trim());
        break;
      }
    }
  }

  return matches;
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function getUnsafeViewTransitionUsage(source: string) {
  const usages: string[] = [];
  const jsxRegex = /<\/?\s*ViewTransition\b/g;

  for (const match of source.matchAll(jsxRegex)) {
    usages.push(match[0]);
  }

  return usages;
}

const violations: string[] = [];

for (const sourceRoot of sourceRoots) {
  for (const filePath of walkSourceFiles(sourceRoot)) {
    const relativePath = toPosixRelative(filePath);
    if (allowedFiles.has(relativePath)) continue;

    const source = fs.readFileSync(filePath, "utf8");
    const executableSource = stripComments(source);
    const unsafeImports = getUnsafeRuntimeImports(executableSource);
    const unsafeViewTransitionUsage = getUnsafeViewTransitionUsage(executableSource);

    for (const unsafeImport of unsafeImports) {
      violations.push(`${relativePath}: unsafe React runtime import: ${unsafeImport}`);
    }

    if (unsafeViewTransitionUsage.length > 0) {
      violations.push(`${relativePath}: raw <ViewTransition> usage outside react-transition wrapper`);
    }
  }
}

console.log(
  `React runtime exports: addTransitionType=${typeof runtime.addTransitionType} ViewTransition=${typeof runtime.ViewTransition} Activity=${typeof React.Activity}`,
);

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
