import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const repoRoot = process.cwd();
const appRoot = path.join(repoRoot, "app");
const require = createRequire(import.meta.url);
const react = require("react") as Record<string, unknown>;

const forbiddenRuntimeImports = new Set(["addTransitionType", "ViewTransition"]);
const ignoredDirectories = new Set([".next", "node_modules"]);

function walkFiles(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (ignoredDirectories.has(entry)) continue;

    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findUnsafeReactImports(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const unsafeNames: string[] = [];
  const importPattern = /import\s+([\s\S]*?)\s+from\s+["']react["'];/g;

  for (const match of source.matchAll(importPattern)) {
    const importClause = match[1];
    const namedImportMatch = importClause.match(/\{([\s\S]*?)\}/);
    if (!namedImportMatch) continue;

    const importedNames = namedImportMatch[1]
      .split(",")
      .map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0])
      .filter(Boolean);

    for (const name of importedNames) {
      if (forbiddenRuntimeImports.has(name)) {
        unsafeNames.push(name);
      }
    }
  }

  return unsafeNames;
}

const unsafeImports = walkFiles(appRoot).flatMap((filePath) => {
  const unsafeNames = findUnsafeReactImports(filePath);
  return unsafeNames.map((name) => ({
    filePath: path.relative(repoRoot, filePath),
    name,
  }));
});

console.log(
  `react runtime: addTransitionType=${typeof react.addTransitionType} ViewTransition=${typeof react.ViewTransition} Activity=${typeof react.Activity}`,
);

if (unsafeImports.length > 0) {
  console.error("Unsafe runtime imports from react found:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport.filePath}: ${unsafeImport.name}`);
  }
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
