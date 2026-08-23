import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";

const rootDir = process.cwd();
const appDir = path.join(rootDir, "app");
const forbiddenRuntimeImports = new Set(["addTransitionType", "ViewTransition"]);

type UnsafeImport = {
  file: string;
  name: string;
  statement: string;
};

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

function findUnsafeReactImports(filePath: string): UnsafeImport[] {
  const source = readFileSync(filePath, "utf8");
  const imports = source.matchAll(/import\s+([\s\S]*?)\s+from\s+["']react["'];?/g);
  const unsafe: UnsafeImport[] = [];

  for (const match of imports) {
    const statement = match[0].replace(/\s+/g, " ").trim();

    if (/^import\s+type\b/.test(statement)) {
      continue;
    }

    const namedImports = match[1].match(/\{([\s\S]*?)\}/);
    if (!namedImports) {
      continue;
    }

    for (const rawSpecifier of namedImports[1].split(",")) {
      const specifier = rawSpecifier.trim();
      if (!specifier || specifier.startsWith("type ")) {
        continue;
      }

      const importedName = specifier.split(/\s+as\s+/)[0]?.trim();
      if (importedName && forbiddenRuntimeImports.has(importedName)) {
        unsafe.push({
          file: path.relative(rootDir, filePath),
          name: importedName,
          statement,
        });
      }
    }
  }

  return unsafe;
}

const reactRuntime = React as typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

console.log(
  `React runtime exports: addTransitionType=${typeof reactRuntime.addTransitionType} ViewTransition=${typeof reactRuntime.ViewTransition}`,
);

const unsafeImports = walk(appDir).flatMap(findUnsafeReactImports);

if (unsafeImports.length > 0) {
  console.error("Unsafe React transition runtime imports found:");
  for (const unsafeImport of unsafeImports) {
    console.error(
      `- ${unsafeImport.file}: ${unsafeImport.name} via ${unsafeImport.statement}`,
    );
  }
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
