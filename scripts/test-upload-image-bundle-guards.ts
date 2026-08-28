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
const handleSubmitIndex = source.indexOf("const handleSubmit = useCallback");
const handleSubmitSource = source.slice(handleSubmitIndex);
const submitConversionGuardIndex = handleSubmitSource.indexOf(
  'variant === "Past Papers" && (isConverting || imageConversionInFlightRef.current)',
);
const missingFilesIndex = handleSubmitSource.indexOf("if (files.length === 0)");
const submitStartIndex = handleSubmitSource.indexOf("startTransition(async () => {");

assert.notEqual(
  conversionGuardIndex,
  -1,
  "handleSubmit must block while the latest image bundle PDF is still being generated",
);
assert.notEqual(handleSubmitIndex, -1, "UploadFile should define a submit handler");
assert.notEqual(
  submitConversionGuardIndex,
  -1,
  "handleSubmit must include the conversion guard",
);
assert.ok(
  submitConversionGuardIndex < missingFilesIndex,
  "the conversion guard should run before normal upload validation",
);
assert.ok(
  submitConversionGuardIndex < submitStartIndex,
  "the conversion guard must run before any upload processing starts",
);

assert.match(
  source,
  /<UploadHeader\s+formId=\{ids\.formId\}\s+isConverting=\{isConverting\}\s+pending=\{pending\}/,
  "UploadHeader must receive the conversion state used to disable submit",
);

console.log("upload image bundle guard tests passed");
