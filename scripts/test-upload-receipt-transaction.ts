import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routeSource = readFileSync(
  resolve(__dirname, "../app/api/uploads/route.ts"),
  "utf8",
);
const helperSource = readFileSync(
  resolve(__dirname, "../lib/uploads/create-uploaded-resources.ts"),
  "utf8",
);

const routeUsesSingleTransaction =
  /db\.transaction\(async \(transaction\) => \{[\s\S]*?update\(uploadResultReceipt\)[\s\S]*?createUploadedResources\([\s\S]*?, transaction\)/.test(
    routeSource,
  );

if (!routeUsesSingleTransaction) {
  throw new Error(
    "Upload receipts must be consumed in the same transaction that creates resources.",
  );
}

const helperAcceptsTransaction =
  /database: UploadResourceDatabase = db/.test(helperSource) &&
  !/await db\s*\.\s*insert\((note|pastPaper)\)/.test(helperSource);

if (!helperAcceptsTransaction) {
  throw new Error(
    "createUploadedResources must insert through the provided transaction/database.",
  );
}

console.log("Upload receipt consumption and resource creation share one transaction.");
