import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  new URL("../app/api/uploads/route.ts", import.meta.url),
  "utf8",
);
const createSource = readFileSync(
  new URL("../lib/uploads/create-uploaded-resources.ts", import.meta.url),
  "utf8",
);

assert.match(
  routeSource,
  /const result = await db\.transaction\(async \(transaction\) => \{[\s\S]*createUploadedResources\(\{[\s\S]*dbClient: transaction,[\s\S]*throw new UploadSaveValidationError\(created\.error\);[\s\S]*return created;[\s\S]*\}\);/,
  "upload save must create resources inside the same transaction that consumes receipts",
);

assert.doesNotMatch(
  routeSource,
  /const results = await db\.transaction\(async \(transaction\) => \{[\s\S]*return receiptIds\.map/,
  "receipt consumption must not commit before resource creation begins",
);

assert.match(
  createSource,
  /type UploadResourceDbClient = Pick<typeof db, "insert" \| "select">;/,
  "createUploadedResources must accept a transaction-compatible database client",
);
assert.match(
  createSource,
  /dbClient = db/,
  "createUploadedResources must default to the global DB for non-transaction callers",
);
assert.match(
  createSource,
  /await dbClient\s*\n\s*\.select\(/,
  "createUploadedResources user lookup must use the injected DB client",
);
assert.match(
  createSource,
  /await dbClient\s*\n\s*\.insert\(note\)/,
  "note inserts must use the injected DB client",
);
assert.match(
  createSource,
  /await dbClient\s*\n\s*\.insert\(pastPaper\)/,
  "past-paper inserts must use the injected DB client",
);

console.log("upload receipt atomicity tests passed");
