import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import React from "react";

const REPO_ROOT = process.cwd();
const SOURCE_ROOTS = ["app"];
const EXTENSIONS = new Set([".ts", ".tsx"]);
const UNSAFE_REACT_IMPORT =
  /import\s+(?!type\b)[^;]*\b(?:addTransitionType|ViewTransition)\b[^;]*\sfrom\s+["']react["']/m;
const UNSAFE_REACT_NAMESPACE_USAGE =
  /\bReact\.(?:addTransitionType|ViewTransition)\b/;

async function collectSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(fullPath);
      }

      if (!entry.isFile() || !EXTENSIONS.has(path.extname(entry.name))) {
        return [];
      }

      return [fullPath];
    }),
  );

  return files.flat();
}

async function main() {
  const addTransitionType = (React as typeof React & {
    addTransitionType?: unknown;
  }).addTransitionType;
  const ViewTransition = (React as typeof React & {
    ViewTransition?: unknown;
  }).ViewTransition;

  console.log(
    `React runtime exports: addTransitionType=${typeof addTransitionType} ViewTransition=${typeof ViewTransition}`,
  );

  const sourceFiles = (
    await Promise.all(
      SOURCE_ROOTS.map((root) => collectSourceFiles(path.join(REPO_ROOT, root))),
    )
  ).flat();
  const violations: string[] = [];

  for (const file of sourceFiles) {
    const source = await readFile(file, "utf8");
    if (
      UNSAFE_REACT_IMPORT.test(source) ||
      UNSAFE_REACT_NAMESPACE_USAGE.test(source)
    ) {
      violations.push(path.relative(REPO_ROOT, file));
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Unsafe React transition runtime usage found:\n${violations.join("\n")}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
