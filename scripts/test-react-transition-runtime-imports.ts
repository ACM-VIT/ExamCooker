import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import React from "react";

const repoRoot = process.cwd();
const unsafeNames = new Set(["addTransitionType", "ViewTransition"]);
const sourceRoots = ["app"];
const extensions = new Set([".ts", ".tsx"]);

type ReactRuntime = typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

type UnsafeImport = {
  filePath: string;
  names: string[];
};

const reactRuntime = React as ReactRuntime;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function findUnsafeReactImports(filePath: string): UnsafeImport | null {
  const source = readFileSync(filePath, "utf8");
  const names = new Set<string>();
  const reactImportPattern = /import\s+(?:[\w*\s{},]+?\s+from\s+)?["']react["'];?/g;
  const namedImportPattern = /\{([^}]+)\}/;

  for (const match of source.matchAll(reactImportPattern)) {
    const imports = match[0].match(namedImportPattern)?.[1];
    if (!imports) continue;

    for (const specifier of imports.split(",")) {
      const importedName = specifier
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        ?.trim();

      if (importedName && unsafeNames.has(importedName)) {
        names.add(importedName);
      }
    }
  }

  if (names.size === 0) return null;

  return {
    filePath: path.relative(repoRoot, filePath),
    names: Array.from(names).sort(),
  };
}

const runtimeStatus = {
  addTransitionType: typeof reactRuntime.addTransitionType,
  ViewTransition: typeof reactRuntime.ViewTransition,
};

console.log(
  `React runtime exports: addTransitionType=${runtimeStatus.addTransitionType} ViewTransition=${runtimeStatus.ViewTransition}`,
);

const unsafeImports = sourceRoots
  .flatMap((sourceRoot) => collectSourceFiles(path.join(repoRoot, sourceRoot)))
  .map(findUnsafeReactImports)
  .filter((result): result is UnsafeImport => result !== null);

if (unsafeImports.length > 0) {
  console.error("Unsafe React transition runtime imports found:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport.filePath}: ${unsafeImport.names.join(", ")}`);
  }
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
