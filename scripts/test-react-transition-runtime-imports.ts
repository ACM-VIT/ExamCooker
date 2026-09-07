import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
  Activity?: unknown;
};

const repoRoot = process.cwd();
const appRoot = join(repoRoot, "app");
const wrapperPath = join(
  appRoot,
  "components",
  "common",
  "react-transition.tsx",
);
const forbiddenRuntimeImports = new Set(["addTransitionType", "ViewTransition"]);

function walk(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walk(path));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function getRuntimeReactImports(source: string) {
  const imports: string[] = [];
  const importPattern =
    /import\s+(?!type\b)([\s\S]*?)\s+from\s+["']react["'];?/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source))) {
    imports.push(match[1]);
  }

  return imports;
}

function assertNoUnsafeReactRuntimeImports() {
  const violations: string[] = [];

  for (const file of walk(appRoot)) {
    if (file === wrapperPath) continue;

    const source = stripComments(readFileSync(file, "utf8"));
    for (const imported of getRuntimeReactImports(source)) {
      const namedImport = imported.match(/\{([\s\S]*?)\}/);
      if (!namedImport) continue;

      for (const rawSpecifier of namedImport[1].split(",")) {
        const specifier = rawSpecifier.trim();
        if (!specifier || specifier.startsWith("type ")) continue;

        const importedName = specifier.split(/\s+as\s+/)[0]?.trim();
        if (importedName && forbiddenRuntimeImports.has(importedName)) {
          violations.push(
            `${relative(repoRoot, file)} imports ${importedName} from react`,
          );
        }
      }
    }

    if (/<\/?ViewTransition\b/.test(source)) {
      violations.push(
        `${relative(repoRoot, file)} renders ViewTransition directly`,
      );
    }
  }

  assert.equal(violations.join("\n"), "");
}

function assertWrapperUsesRuntimeFallback() {
  const source = readFileSync(wrapperPath, "utf8");

  assert.match(source, /import React,\s*\{/);
  assert.doesNotMatch(source, /import\s+\{[^}]*\b(addTransitionType|ViewTransition)\b[^}]*\}\s+from\s+["']react["']/);
  assert.match(source, /addTransitionType\?\.\(type\)/);
  assert.match(source, /if \(!ViewTransition\)/);
}

console.log(
  `React runtime exports: addTransitionType=${typeof react.addTransitionType} ViewTransition=${typeof react.ViewTransition} Activity=${typeof react.Activity}`,
);

assertNoUnsafeReactRuntimeImports();
assertWrapperUsesRuntimeFallback();

console.log("React transition runtime import guard passed.");
