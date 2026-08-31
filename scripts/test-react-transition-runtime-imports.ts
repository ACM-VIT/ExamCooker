import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { addOptionalTransitionType, OptionalViewTransition } from "../app/components/common/react-transition";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = join(repoRoot, "app");
const unsafeImports: string[] = [];

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function getImportedNames(importClause: string) {
  return importClause
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .map((specifier) => {
      const withoutTypePrefix = specifier.replace(/^type\s+/, "");
      return {
        name: withoutTypePrefix.split(/\s+as\s+/)[0]?.trim(),
        isTypeOnly: specifier.startsWith("type "),
      };
    });
}

for (const file of walk(appRoot)) {
  if (statSync(file).size === 0) continue;

  const source = readFileSync(file, "utf8");
  const importPattern = /import\s+(?:React,\s*)?\{([^}]+)\}\s+from\s+["']react["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    const importClause = match[1];
    if (!importClause) continue;

    for (const specifier of getImportedNames(importClause)) {
      if (specifier.isTypeOnly) continue;
      if (specifier.name === "addTransitionType" || specifier.name === "ViewTransition") {
        unsafeImports.push(`${relative(repoRoot, file)} imports ${specifier.name} from react`);
      }
    }
  }
}

const reactWithExperimentalTransitions = React as typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ExoticComponent;
};

assert.equal(
  typeof reactWithExperimentalTransitions.addTransitionType,
  "undefined",
  "test assumes the installed React runtime still lacks addTransitionType",
);
assert.equal(
  typeof reactWithExperimentalTransitions.ViewTransition,
  "undefined",
  "test assumes the installed React runtime still lacks ViewTransition",
);
assert.deepEqual(unsafeImports, [], "client code must use the optional transition wrapper");

assert.doesNotThrow(() => addOptionalTransitionType("nav-forward"));
const fallbackElement = OptionalViewTransition({ children: "ok" });
assert.equal(fallbackElement.type, React.Fragment);
assert.equal(fallbackElement.props.children, "ok");

console.log("React transition runtime import guard passed");
