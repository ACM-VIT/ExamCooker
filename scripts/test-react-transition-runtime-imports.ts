import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appRoot = path.join(repoRoot, "app");
const safeWrapperPath = path.join(
  appRoot,
  "components",
  "common",
  "react-transition.tsx",
);

const unsafeReactTransitionImport =
  /import\s+(?:React\s*,\s*)?\{[\s\S]*?\b(?:addTransitionType|ViewTransition)\b[\s\S]*?\}\s+from\s+["']react["']/;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (/\.(?:ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

const offenders = collectSourceFiles(appRoot)
  .filter((file) => file !== safeWrapperPath)
  .filter((file) => unsafeReactTransitionImport.test(readFileSync(file, "utf8")))
  .map((file) => path.relative(repoRoot, file));

assert.deepEqual(
  offenders,
  [],
  "Experimental React transition APIs must be imported from app/components/common/react-transition, not directly from react.",
);

const require = createRequire(import.meta.url);
const react = require("react") as Record<string, unknown>;

console.log(
  "React transition runtime exports:",
  `addTransitionType=${typeof react.addTransitionType}`,
  `ViewTransition=${typeof react.ViewTransition}`,
);
