import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/components/upload-file.tsx", "utf8");

assert.match(
  source,
  /disabled=\{pending \|\| isConverting\}/,
  "the upload button must stay disabled while image pages are being converted",
);

assert.match(
  source,
  /pending \? "Uploading\.\.\." : isConverting \? "Processing\.\.\." : "Upload"/,
  "the upload button should tell users that image conversion is still processing",
);

const conversionGuardIndex = source.indexOf(
  'variant === "Past Papers" && (isConverting || imageConversionInFlightRef.current)',
);
const missingFilesIndex = source.indexOf("if (files.length === 0)");
const submitStartIndex = source.indexOf("startTransition(async () => {");

assert.notEqual(
  conversionGuardIndex,
  -1,
  "handleSubmit must block while the latest image bundle PDF is still being generated",
);
assert.ok(
  conversionGuardIndex < missingFilesIndex,
  "the conversion guard should run before normal upload validation",
);
assert.ok(
  conversionGuardIndex < submitStartIndex,
  "the conversion guard must run before any upload processing starts",
);

assert.match(
  source,
  /<UploadHeader\s+formId=\{ids\.formId\}\s+isConverting=\{isConverting\}\s+pending=\{pending\}/,
  "UploadHeader must receive the conversion state used to disable submit",
);

console.log("upload image bundle guard tests passed");
