import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const react = require("react") as {
  addTransitionType?: unknown;
  ViewTransition?: unknown;
};

const repoRoot = resolve(__dirname, "..");
const filesToCheck = [
  "app/(app)/home/course-search.tsx",
  "app/components/command-palette.tsx",
  "app/components/common/directional-transition.tsx",
  "app/components/common/react-transition.tsx",
  "app/components/mobile-tab-bar.tsx",
  "app/components/nav-bar.tsx",
  "app/components/notes/notes-course-search.tsx",
  "app/components/past_papers/answer-key-toggle.tsx",
  "app/components/past_papers/course-paper-grid.tsx",
  "app/components/past_papers/filter-bar.tsx",
  "app/components/past_papers/past-papers-course-search.tsx",
  "app/components/past_papers/sort-dropdown.tsx",
  "app/components/voice/voice-agent-provider.tsx",
];

const unsafePatterns = [
  {
    label: "runtime addTransitionType import",
    pattern: /import\s+(?:React,\s*)?\{[^}]*\baddTransitionType\b[^}]*\}\s+from\s+["']react["']/,
  },
  {
    label: "runtime ViewTransition import",
    pattern: /import\s+(?:React,\s*)?\{[^}]*\bViewTransition\b[^}]*\}\s+from\s+["']react["']/,
  },
  {
    label: "direct ViewTransition element",
    pattern: /<\/?ViewTransition[\s>]/,
  },
];

const failures: string[] = [];

function stripComments(contents: string) {
  return contents
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

for (const file of filesToCheck) {
  const absolutePath = resolve(repoRoot, file);
  const contents = stripComments(readFileSync(absolutePath, "utf8"));
  for (const { label, pattern } of unsafePatterns) {
    if (file === "app/components/common/react-transition.tsx") continue;
    if (pattern.test(contents)) {
      failures.push(`${relative(repoRoot, absolutePath)} still has ${label}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(failures.join("\n"));
}

console.log(
  `React runtime transition exports: addTransitionType=${typeof react.addTransitionType}, ViewTransition=${typeof react.ViewTransition}`,
);
console.log("No unsafe React transition runtime imports found.");
