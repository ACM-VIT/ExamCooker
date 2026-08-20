import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import * as React from "react";

const root = process.cwd();
const sourceRoots = ["app", "lib"];
const allowedFiles = new Set([
  path.join("app", "components", "common", "react-transition.tsx"),
]);
const sourceExtensions = new Set([".ts", ".tsx"]);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      yield* walk(fullPath);
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

function hasUnsafeReactTransitionImport(source: string) {
  const reactImportPattern = /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']react["']/g;
  const unsafeSpecifierPattern = /\b(addTransitionType|ViewTransition)\b/;

  for (const match of source.matchAll(reactImportPattern)) {
    if (!match[0].startsWith("import type") && unsafeSpecifierPattern.test(match[0])) {
      return true;
    }
  }

  return false;
}

async function main() {
  const unsafeFiles: string[] = [];

  for (const sourceRoot of sourceRoots) {
    for await (const file of walk(path.join(root, sourceRoot))) {
      const relativePath = path.relative(root, file);
      if (allowedFiles.has(relativePath)) continue;

      const source = await readFile(file, "utf8");
      if (hasUnsafeReactTransitionImport(source)) {
        unsafeFiles.push(relativePath);
      }
    }
  }

  const reactRuntime = React as typeof React & {
    addTransitionType?: unknown;
    ViewTransition?: unknown;
  };

  console.log(
    `React runtime: addTransitionType=${typeof reactRuntime.addTransitionType} ViewTransition=${typeof reactRuntime.ViewTransition}`,
  );

  if (unsafeFiles.length > 0) {
    throw new Error(
      `Unsafe React transition runtime imports found:\n${unsafeFiles
        .map((file) => `- ${file}`)
        .join("\n")}`,
    );
  }

  console.log("No unsafe React transition runtime imports found.");
}

void main();
