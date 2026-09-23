import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
  Activity?: unknown;
};

const root = process.cwd();
const sourceRoots = ["app", "lib"];
const allowedRuntimeImport = "app/components/common/react-transition.tsx";
const unsafeMatches: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") return [];
      return walk(path);
    }

    return /\.(tsx?|jsx?)$/.test(entry) ? [path] : [];
  });
}

function inspectFile(path: string) {
  const rel = relative(root, path);
  const source = readFileSync(path, "utf8");

  const importPattern =
    /import\s+(?:React\s*,\s*)?\{([^}]+)\}\s+from\s+["']react["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    const importedNames = match[1]
      .split(",")
      .map((part) => part.trim().split(/\s+as\s+/)[0]?.trim())
      .filter(Boolean);

    for (const name of importedNames) {
      if (
        (name === "addTransitionType" || name === "ViewTransition") &&
        rel !== allowedRuntimeImport
      ) {
        unsafeMatches.push(`${rel}: imports ${name} directly from react`);
      }
    }
  }
}

for (const sourceRoot of sourceRoots) {
  for (const file of walk(join(root, sourceRoot))) {
    inspectFile(file);
  }
}

console.log(
  [
    `addTransitionType=${typeof react.addTransitionType}`,
    `ViewTransition=${typeof react.ViewTransition}`,
    `Activity=${typeof react.Activity}`,
  ].join(" "),
);

if (unsafeMatches.length > 0) {
  console.error("Unsafe React transition runtime imports found:");
  for (const item of unsafeMatches) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}
