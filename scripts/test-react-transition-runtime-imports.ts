import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const sourceRoots = ["app", "lib"];
const forbiddenRuntimeExports = ["addTransitionType", "ViewTransition"];
const reactImportPattern = /import\s+(?!type\b)([\s\S]*?)\s+from\s+["']react["'];/g;

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(path);
    }
  }

  return files;
}

const violations: string[] = [];

for (const root of sourceRoots) {
  for (const file of collectSourceFiles(join(repoRoot, root))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(reactImportPattern)) {
      const importClause = match[1] ?? "";
      const namedImport = importClause.match(/\{([\s\S]*?)\}/);
      if (!namedImport) continue;

      const names = namedImport[1]
        .split(",")
        .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim())
        .filter(Boolean);
      const forbidden = names.filter((name) =>
        forbiddenRuntimeExports.includes(name),
      );

      if (forbidden.length > 0) {
        violations.push(
          `${relative(repoRoot, file)} imports ${forbidden.join(", ")} from react`,
        );
      }
    }
  }
}

assert.deepEqual(
  violations,
  [],
  "Use app/components/common/react-transition.tsx for experimental React transition runtime APIs",
);

console.log("react transition runtime import tests passed");
