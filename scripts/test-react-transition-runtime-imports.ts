import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const repoRoot = path.resolve(__dirname, "..");
const appRoot = path.join(repoRoot, "app");
const unsafeRuntimeNames = new Set(["addTransitionType", "ViewTransition"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const violations: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      return walk(filePath);
    }

    if (!sourceExtensions.has(path.extname(entry))) {
      return [];
    }

    return [filePath];
  });
}

for (const filePath of walk(appRoot)) {
  const source = readFileSync(filePath, "utf8");
  const importPattern = /import\s+([\s\S]*?)\s+from\s+["']react["'];/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    const importClause = match[1].trim();
    if (importClause.startsWith("type ")) {
      continue;
    }

    const namedImports = importClause.match(/\{([\s\S]*?)\}/);
    if (!namedImports) {
      continue;
    }

    for (const rawSpecifier of namedImports[1].split(",")) {
      const specifier = rawSpecifier.trim();
      if (!specifier || specifier.startsWith("type ")) {
        continue;
      }

      const importedName = specifier.split(/\s+as\s+/)[0]?.trim();
      if (importedName && unsafeRuntimeNames.has(importedName)) {
        violations.push(`${path.relative(repoRoot, filePath)} imports ${importedName} from react`);
      }
    }
  }
}

console.log(
  [
    `addTransitionType=${typeof react.addTransitionType}`,
    `ViewTransition=${typeof react.ViewTransition}`,
  ].join(" "),
);

if (violations.length > 0) {
  throw new Error(
    `Unsafe React transition runtime imports found:\n${violations.join("\n")}`,
  );
}

console.log("React transition runtime import guard passed.");
