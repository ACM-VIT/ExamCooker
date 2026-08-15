import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};
const reactPackage = require("react/package.json") as { version: string };

const projectRoot = join(import.meta.dirname, "..");
const sourceRoots = ["app"];
const unsafeReactExports = new Set(["addTransitionType", "ViewTransition"]);
const sourceExtensions = new Set([".ts", ".tsx"]);

function walkFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...walkFiles(path));
      continue;
    }

    if ([...sourceExtensions].some((extension) => path.endsWith(extension))) {
      files.push(path);
    }
  }

  return files;
}

function importedNames(importStatement: string) {
  const namedImportMatch = importStatement.match(/\{([\s\S]*?)\}/);
  if (!namedImportMatch) return [];

  return namedImportMatch[1]
    .split(",")
    .map((specifier) =>
      specifier
        .trim()
        .replace(/^type\s+/, "")
        .split(/\s+as\s+/)[0]
        .trim(),
    )
    .filter(Boolean);
}

const unsafeImports: string[] = [];
const reactImportPattern =
  /import\s+(?:React\s*,\s*)?\{[\s\S]*?\}\s+from\s+["']react["'];/g;

for (const sourceRoot of sourceRoots) {
  for (const file of walkFiles(join(projectRoot, sourceRoot))) {
    if (file.endsWith("app/components/common/react-transition.tsx")) continue;

    const contents = readFileSync(file, "utf8");
    for (const importStatement of contents.matchAll(reactImportPattern)) {
      const names = importedNames(importStatement[0]).filter((name) =>
        unsafeReactExports.has(name),
      );
      if (names.length > 0) {
        unsafeImports.push(`${relative(projectRoot, file)} imports ${names.join(", ")}`);
      }
    }
  }
}

console.log(
  `react ${reactPackage.version}: addTransitionType=${typeof react.addTransitionType}, ViewTransition=${typeof react.ViewTransition}`,
);

if (unsafeImports.length > 0) {
  console.error("Unsafe direct React transition imports found:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport}`);
  }
  process.exit(1);
}

console.log("No unsafe direct React transition imports found.");
