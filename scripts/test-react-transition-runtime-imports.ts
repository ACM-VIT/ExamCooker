import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";

const repoRoot = process.cwd();
const sourceRoots = ["app"];
const allowedDirectImportFiles = new Set([
  "app/components/common/react-transition.tsx",
]);

function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;

    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findUnsafeReactTransitionImports() {
  const unsafeFiles: string[] = [];
  const importFromReactPattern = /import\s+[\s\S]*?\s+from\s+["']react["'];?/g;
  const unsafeImportNamePattern = /\b(?:addTransitionType|ViewTransition)\b/;

  for (const sourceRoot of sourceRoots) {
    for (const file of walkFiles(path.join(repoRoot, sourceRoot))) {
      const relativePath = path.relative(repoRoot, file).split(path.sep).join("/");
      if (allowedDirectImportFiles.has(relativePath)) continue;

      const source = readFileSync(file, "utf8");
      const importBlocks = source.match(importFromReactPattern) ?? [];
      const hasUnsafeImport = importBlocks.some((importBlock) => (
        !/^\s*import\s+type\b/.test(importBlock) &&
        unsafeImportNamePattern.test(importBlock)
      ));

      if (hasUnsafeImport) {
        unsafeFiles.push(relativePath);
      }
    }
  }

  return unsafeFiles;
}

const addTransitionTypeType = typeof (React as { addTransitionType?: unknown }).addTransitionType;
const viewTransitionType = typeof (React as { ViewTransition?: unknown }).ViewTransition;
const activityType = typeof (React as { Activity?: unknown }).Activity;
const unsafeFiles = findUnsafeReactTransitionImports();

console.log(
  `React runtime: addTransitionType=${addTransitionTypeType} ViewTransition=${viewTransitionType} Activity=${activityType}`,
);

if (unsafeFiles.length > 0) {
  console.error("Unsafe direct React transition imports found:");
  for (const file of unsafeFiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("No unsafe direct React transition imports found.");
