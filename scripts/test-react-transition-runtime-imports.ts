import React from "react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type ReactTransitionRuntime = typeof React & {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const repoRoot = process.cwd();
const scanRoots = ["app", "lib"];
const unsafeNames = ["addTransitionType", "ViewTransition"];
const unsafeMemberPattern = /\bReact\.(?:addTransitionType|ViewTransition)\b/;
const reactImportPattern = /import\s+(?!type\b)[\s\S]*?\s+from\s+["']react["'];?/g;
const allowedFiles = new Set(["app/components/common/react-transition.tsx"]);
const reactRuntime = React as ReactTransitionRuntime;
const failures: string[] = [];

function walkFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (entry === ".next" || entry === "node_modules") continue;
      files.push(...walkFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx)$/.test(entry)) {
      files.push(fullPath);
    }
  }

  return files;
}

for (const root of scanRoots) {
  for (const file of walkFiles(join(repoRoot, root))) {
    const relativePath = relative(repoRoot, file);
    if (allowedFiles.has(relativePath)) continue;

    const source = readFileSync(file, "utf8");
    const reactImports = source.match(reactImportPattern) ?? [];
    const unsafeImports = reactImports.filter((statement) =>
      unsafeNames.some((name) => statement.includes(name)),
    );

    if (unsafeImports.length > 0 || unsafeMemberPattern.test(source)) {
      failures.push(relativePath);
    }
  }
}

console.log(
  [
    `addTransitionType=${typeof reactRuntime.addTransitionType}`,
    `ViewTransition=${typeof reactRuntime.ViewTransition}`,
    `Activity=${typeof React.Activity}`,
  ].join(" "),
);

if (failures.length > 0) {
  throw new Error(
    `Unsafe React transition runtime usage found:\\n${failures
      .map((file) => `- ${file}`)
      .join("\\n")}`,
  );
}
