import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../app/actions/content-correction-reports.ts"),
  "utf8",
);

const checks = [
  {
    label: "note to past paper conversion",
    pattern:
      /insert\(pastPaper\)[\s\S]*?values\(\{[\s\S]*?contentHash: source\.contentHash,[\s\S]*?isClear: true,/,
  },
  {
    label: "past paper to note conversion",
    pattern:
      /insert\(note\)[\s\S]*?values\(\{[\s\S]*?contentHash: source\.contentHash,[\s\S]*?isClear: true,/,
  },
];

const failures = checks
  .filter(({ pattern }) => !pattern.test(source))
  .map(({ label }) => label);

if (failures.length > 0) {
  throw new Error(
    `Converted published resources must remain published; failed checks: ${failures.join(", ")}`,
  );
}

console.log("Correction report convert_type keeps converted replacements published.");
