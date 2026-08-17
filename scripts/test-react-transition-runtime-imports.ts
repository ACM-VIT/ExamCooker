import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as React from "react";

const repoRoot = process.cwd();
const scanRoots = ["app", "lib"];
const unsafeReactTransitionImport =
    /import\s+(?:React\s*,\s*)?\{[^;]*\b(?:addTransitionType|ViewTransition)\b[^;]*\}\s+from\s+["']react["'];?/g;

async function walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return walk(fullPath);
            if (!/\.(tsx?|jsx?)$/.test(entry.name)) return [];
            return [fullPath];
        }),
    );

    return files.flat();
}

function lineNumberAt(source: string, index: number) {
    return source.slice(0, index).split("\n").length;
}

async function main() {
    const files = (
        await Promise.all(scanRoots.map((root) => walk(path.join(repoRoot, root))))
    ).flat();
    const violations: string[] = [];

    for (const file of files) {
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(unsafeReactTransitionImport)) {
            violations.push(
                `${path.relative(repoRoot, file)}:${lineNumberAt(source, match.index ?? 0)}`,
            );
        }
    }

    console.log(
        `React runtime transition exports: addTransitionType=${typeof React.addTransitionType}, ViewTransition=${typeof React.ViewTransition}`,
    );

    if (violations.length > 0) {
        console.error(
            [
                "Unsafe runtime imports from react found.",
                "Use app/components/common/react-transition.tsx so stable React builds fall back safely.",
                ...violations,
            ].join("\n"),
        );
        process.exitCode = 1;
    }
}

void main();
