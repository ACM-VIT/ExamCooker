import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const react = require("react") as {
  Activity?: unknown;
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const projectRoot = process.cwd();
const appRoot = path.join(projectRoot, "app");
const allowedRuntimeImportFiles = new Set([
  path.join("app", "components", "common", "react-transition.tsx"),
]);
const unsafeRuntimeImports = new Set(["addTransitionType", "ViewTransition"]);
const reactImportPattern =
  /import\s+(type\s+)?([\s\S]*?)\s+from\s+["']react["'];?/g;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (stats.isFile() && /\.(tsx?|jsx?)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations: string[] = [];

for (const filePath of collectSourceFiles(appRoot)) {
  const relativePath = path.relative(projectRoot, filePath);
  if (allowedRuntimeImportFiles.has(relativePath)) {
    continue;
  }

  const source = readFileSync(filePath, "utf8");
  for (const match of source.matchAll(reactImportPattern)) {
    if (match[1]) continue;

    const importClause = match[2] ?? "";
    const openBrace = importClause.indexOf("{");
    const closeBrace = importClause.lastIndexOf("}");
    if (openBrace === -1 || closeBrace === -1 || closeBrace <= openBrace) {
      continue;
    }

    const namedImports = importClause.slice(openBrace + 1, closeBrace).split(",");
    for (const namedImport of namedImports) {
      const specifier = namedImport.trim();
      if (!specifier || specifier.startsWith("type ")) continue;

      const importedName = specifier.split(/\s+as\s+/u)[0]?.trim();
      if (!importedName || !unsafeRuntimeImports.has(importedName)) continue;

      const importOffset = match.index + openBrace + 1 + importClause
        .slice(openBrace + 1, closeBrace)
        .indexOf(namedImport);
      const prefix = source.slice(0, importOffset);
      const line = prefix.split("\n").length;
      const lastLineBreak = prefix.lastIndexOf("\n");
      const character = importOffset - lastLineBreak;
      violations.push(
        `${relativePath}:${line}:${character} imports ${importedName} from react at runtime`,
      );
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `React transition runtime imports must go through app/components/common/react-transition.tsx:\n${violations.join("\n")}`,
);

console.log(
  [
    `addTransitionType=${typeof react.addTransitionType}`,
    `ViewTransition=${typeof react.ViewTransition}`,
    `Activity=${typeof react.Activity}`,
  ].join(" "),
);
console.log("React transition runtime import guard passed");
