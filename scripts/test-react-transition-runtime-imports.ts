import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";

const repoRoot = process.cwd();
const appRoot = join(repoRoot, "app");
const allowedWrapperPath = join(
  "app",
  "components",
  "common",
  "react-transition.tsx",
);
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const unsafeNames = new Set(["addTransitionType", "ViewTransition"]);

type UnsafeImport = {
  file: string;
  name: string;
};

function hasSourceExtension(filePath: string) {
  return Array.from(sourceExtensions).some((extension) =>
    filePath.endsWith(extension),
  );
}

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (stats.isFile() && hasSourceExtension(path)) {
      files.push(path);
    }
  }

  return files;
}

function parseNamedImports(importNames: string) {
  return importNames
    .split(",")
    .map((name) => name.trim().split(/\s+as\s+/u)[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

const unsafeImports: UnsafeImport[] = [];
const reactNamedImportPattern =
  /import\s+(?!type\b)[\s\S]*?\{([^}]*)\}[\s\S]*?from\s+["']react["']/gu;

for (const file of collectSourceFiles(appRoot)) {
  const relativePath = relative(repoRoot, file);

  if (relativePath === allowedWrapperPath) {
    continue;
  }

  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(reactNamedImportPattern)) {
    const names = match[1];
    if (!names) continue;

    for (const name of parseNamedImports(names)) {
      if (unsafeNames.has(name)) {
        unsafeImports.push({ file: relativePath, name });
      }
    }
  }
}

const reactRuntime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

console.log(
  `react transition runtime exports: addTransitionType=${typeof reactRuntime.addTransitionType} ViewTransition=${typeof reactRuntime.ViewTransition}`,
);

if (unsafeImports.length > 0) {
  console.error("Unsafe direct React transition imports found:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport.file}: ${unsafeImport.name}`);
  }
  process.exit(1);
}

console.log("No unsafe direct React transition imports found.");
