import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import React from "react";
import * as ts from "typescript-api";

const rootDir = process.cwd();
const appDir = path.join(rootDir, "app");
const transitionWrapperPath = path.join(
  appDir,
  "components",
  "common",
  "react-transition.tsx",
);
const unsafeReactExports = new Set(["addTransitionType", "ViewTransition"]);
const unsafeRuntimeUses: string[] = [];

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      files.push(...walk(filePath));
      continue;
    }

    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      files.push(filePath);
    }
  }

  return files;
}

function relative(filePath: string) {
  return path.relative(rootDir, filePath);
}

function inspectImport(filePath: string, sourceFile: ts.SourceFile, node: ts.ImportDeclaration) {
  if (!ts.isStringLiteral(node.moduleSpecifier) || node.moduleSpecifier.text !== "react") {
    return;
  }

  const namedBindings = node.importClause?.namedBindings;
  if (!namedBindings || !ts.isNamedImports(namedBindings)) {
    return;
  }

  for (const specifier of namedBindings.elements) {
    if (specifier.isTypeOnly || node.importClause?.isTypeOnly) {
      continue;
    }

    const importedName = specifier.propertyName?.text ?? specifier.name.text;
    if (unsafeReactExports.has(importedName)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(specifier.getStart(sourceFile));
      unsafeRuntimeUses.push(
        `${relative(filePath)}:${line + 1}:${character + 1} imports ${importedName} from react at runtime`,
      );
    }
  }
}

function inspectJsx(filePath: string, sourceFile: ts.SourceFile, node: ts.Node) {
  if (filePath === transitionWrapperPath) {
    return;
  }

  const tagName = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)
    ? node.tagName
    : undefined;

  if (!tagName || !ts.isIdentifier(tagName) || tagName.text !== "ViewTransition") {
    return;
  }

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(tagName.getStart(sourceFile));
  unsafeRuntimeUses.push(
    `${relative(filePath)}:${line + 1}:${character + 1} renders <ViewTransition> directly`,
  );
}

function inspectNode(filePath: string, sourceFile: ts.SourceFile, node: ts.Node) {
  if (ts.isImportDeclaration(node)) {
    inspectImport(filePath, sourceFile, node);
  }

  inspectJsx(filePath, sourceFile, node);
  ts.forEachChild(node, (child) => inspectNode(filePath, sourceFile, child));
}

for (const filePath of walk(appDir)) {
  const sourceText = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  inspectNode(filePath, sourceFile, sourceFile);
}

assert.deepEqual(
  unsafeRuntimeUses,
  [],
  `React transition exports are not available in the installed runtime; use app/components/common/react-transition.tsx instead:\n${unsafeRuntimeUses.join("\n")}`,
);

const transitionRuntime = React as typeof React & {
  addTransitionType?: (type: string) => void;
  ViewTransition?: unknown;
};

console.log(
  [
    `addTransitionType=${typeof transitionRuntime.addTransitionType}`,
    `ViewTransition=${typeof transitionRuntime.ViewTransition}`,
    `Activity=${typeof React.Activity}`,
    "no unsafe React transition runtime imports found",
  ].join(" "),
);
