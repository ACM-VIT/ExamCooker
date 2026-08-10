import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const uploadFilePath = resolve(__dirname, "../app/components/upload-file.tsx");
const source = readFileSync(uploadFilePath, "utf8");

const requiredSnippets = [
  {
    label: "submit guard blocks conversion-in-flight uploads",
    snippet:
      'variant === "Past Papers" && (isConverting || imageConversionInFlightRef.current)',
  },
  {
    label: "upload button disables during image conversion",
    snippet: "disabled={pending || isConverting}",
  },
  {
    label: "image bundle conversion reads latest state from a ref",
    snippet: "const currentImageBundleState = latestImageBundleStateRef.current;",
  },
  {
    label: "image bundle conversion updates latest state before dispatch",
    snippet: "latestImageBundleStateRef.current = {\n                        fileTitles: nextFileTitles,\n                        files: [mergedPdf],",
  },
  {
    label: "file removal keeps latest bundle ref in sync",
    snippet: "latestImageBundleStateRef.current = {\n                fileTitles: nextTitles,\n                files: nextFiles,",
  },
];

const missing = requiredSnippets.filter(({ snippet }) => !source.includes(snippet));

if (missing.length > 0) {
  throw new Error(
    missing
      .map(({ label }) => `Missing upload image-bundle guard: ${label}`)
      .join("\n"),
  );
}

console.log("Upload image-bundle conversion guards are present.");
