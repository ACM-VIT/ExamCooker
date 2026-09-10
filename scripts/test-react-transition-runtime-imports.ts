import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as ReactRuntime from "react";

const repoRoot = process.cwd();
const appDir = path.join(repoRoot, "app");
const allowedWrapperPath = path.join(
  appDir,
  "components",
  "common",
  "react-transition.tsx",
);
const unsafeNames = ["addTransitionType", "ViewTransition"];
const unsafeImports: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!/\.(tsx|ts)$/.test(entry.name) || fullPath === allowedWrapperPath) {
      continue;
    }

    const source = readFileSync(fullPath, "utf8");
    const importPattern = /import\s+(?!type\b)([\s\S]*?)\s+from\s+["']react["'];/g;
    for (const match of source.matchAll(importPattern)) {
      const importClause = match[1] ?? "";
      for (const name of unsafeNames) {
        const namedImportPattern = new RegExp(`\\b${name}\\b`);
        if (namedImportPattern.test(importClause)) {
          unsafeImports.push(
            `${path.relative(repoRoot, fullPath)} imports ${name} from react`,
          );
        }
      }
    }
  }
}

walk(appDir);

const runtimeAddTransitionType = typeof ReactRuntime.addTransitionType;
const runtimeViewTransition = typeof ReactRuntime.ViewTransition;

console.log(
  `react@${ReactRuntime.version}: addTransitionType=${runtimeAddTransitionType} ViewTransition=${runtimeViewTransition}`,
);

if (unsafeImports.length > 0) {
  console.error("Unsafe React transition runtime imports found:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport}`);
  }
  process.exit(1);
}

if (
  (runtimeAddTransitionType !== "function" ||
    runtimeViewTransition !== "function") &&
  unsafeImports.length === 0
) {
  console.log("Runtime transition exports are unavailable; guarded wrapper is in use.");
}
