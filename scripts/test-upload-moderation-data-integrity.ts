import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const uploadRouteSource = readSource("app/api/uploads/route.ts");
const uploadHelperSource = readSource("lib/uploads/create-uploaded-resources.ts");
const cliUploadRouteSource = readSource("app/api/cli/uploads/route.ts");
const moderatorActionsSource = readSource("app/actions/moderator-actions.ts");

assert.match(
  uploadRouteSource,
  /const result = await db\.transaction\(async \(transaction\) => \{/,
  "upload save must wrap receipt consumption and resource creation in one transaction",
);
assert.match(
  uploadRouteSource,
  /\.set\(\{ consumedAt: now \}\)[\s\S]*createUploadedResources\(\{[\s\S]*database: transaction,/,
  "upload receipts must be consumed in the same transaction used to insert resources",
);
assert.match(
  uploadRouteSource,
  /throw new UploadSaveValidationError\(uploadResult\);/,
  "validation failures from resource creation must roll back consumed receipts",
);
assert.match(
  uploadRouteSource,
  /await runUploadedResourcePostSaveTasks\(variant, result\.data\);/,
  "upload review and cache side effects must run after the transaction commits",
);
assert.doesNotMatch(
  uploadHelperSource,
  /after\(async \(\) => \{/,
  "createUploadedResources must not schedule post-save side effects while running inside a transaction",
);
assert.match(
  cliUploadRouteSource,
  /await runUploadedResourcePostSaveTasks\(variant, result\.data\);/,
  "CLI uploads must preserve post-save review and cache side effects",
);

assert.match(
  moderatorActionsSource,
  /eq\(note\.isClear, false\)[\s\S]*isNull\(note\.moderationArchivedAt\)/,
  "note deletion must be restricted to pending moderation rows",
);
assert.match(
  moderatorActionsSource,
  /eq\(pastPaper\.questionPaperId, id\)/,
  "paper deletion must check for linked answer keys before deleting a question paper",
);
assert.match(
  moderatorActionsSource,
  /eq\(pastPaper\.isClear, false\)[\s\S]*isNull\(pastPaper\.moderationArchivedAt\)/,
  "past paper deletion must be restricted to pending moderation rows",
);

console.log("upload and moderation data integrity tests passed");
