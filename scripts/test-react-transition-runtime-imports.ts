import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import React from "react";
import {
  OptionalViewTransition,
  addTransitionType,
} from "../app/components/common/react-transition";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCE_DIRS = ["app", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const UNSAFE_REACT_TRANSITION_IMPORT =
  /import\s+(?:React\s*,\s*)?\{[^}]*\b(?:addTransitionType|ViewTransition)\b[^}]*\}\s+from\s+["']react["']/;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walk(path));
    } else if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
      files.push(path);
    }
  }

  return files;
}

const unsafeImports = SOURCE_DIRS.flatMap((dir) =>
  walk(join(ROOT, dir)).filter((file) =>
    UNSAFE_REACT_TRANSITION_IMPORT.test(readFileSync(file, "utf8")),
  ),
);

assert.deepEqual(
  unsafeImports.map((file) => relative(ROOT, file)),
  [],
  "experimental React transition APIs must be imported from the runtime-safe wrapper",
);

const reactRuntime = React as typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: React.ComponentType;
};

assert.equal(
  typeof reactRuntime.addTransitionType,
  "undefined",
  "this regression test expects the installed React runtime to omit addTransitionType",
);
assert.equal(
  typeof reactRuntime.ViewTransition,
  "undefined",
  "this regression test expects the installed React runtime to omit ViewTransition",
);

assert.doesNotThrow(() => addTransitionType("nav-forward"));

const fallback = OptionalViewTransition({ children: "content", default: "none" });
assert.equal(
  fallback.type,
  React.Fragment,
  "OptionalViewTransition should fall back to a fragment when React has no ViewTransition runtime export",
);

console.log("React transition runtime import tests passed");
