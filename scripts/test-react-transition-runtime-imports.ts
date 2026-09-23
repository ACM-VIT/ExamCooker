import { createRequire } from "module";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
  Activity?: unknown;
};

const root = process.cwd();
const appDir = join(root, "app");
const unsafeNames = ["addTransitionType", "ViewTransition"];
const allowedRuntimeAdapter = "app/components/common/react-transition.tsx";
const unsafeImports: string[] = [];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const file of walk(appDir)) {
  const relativePath = relative(root, file);

  if (relativePath === allowedRuntimeAdapter) {
    continue;
  }

  const source = readFileSync(file, "utf8");
  const reactImports = source.matchAll(/import\s+(?!type\b)[\s\S]*?\sfrom\s+["']react["'];?/g);

  for (const match of reactImports) {
    const statement = match[0];
    const matchedUnsafeNames = unsafeNames.filter((name) =>
      new RegExp(`\\b${name}\\b`).test(statement),
    );

    if (matchedUnsafeNames.length > 0) {
      unsafeImports.push(`${relativePath}: ${matchedUnsafeNames.join(", ")}`);
    }
  }
}

console.log(
  [
    `addTransitionType=${typeof react.addTransitionType}`,
    `ViewTransition=${typeof react.ViewTransition}`,
    `Activity=${typeof react.Activity}`,
  ].join(" "),
);

if (unsafeImports.length > 0) {
  console.error("Unsafe runtime imports from react:");
  for (const unsafeImport of unsafeImports) {
    console.error(`- ${unsafeImport}`);
  }
  process.exit(1);
}

console.log("No unsafe React transition runtime imports found.");
