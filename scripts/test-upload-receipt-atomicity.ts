import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync("app/api/uploads/route.ts", "utf8");
const helperSource = readFileSync("lib/uploads/create-uploaded-resources.ts", "utf8");

assert.match(
  helperSource,
  /type UploadDatabaseClient = Pick<typeof db, "insert" \| "select">;/,
  "createUploadedResources should accept the transaction-capable database surface",
);

assert.match(
  helperSource,
  /dbClient\?: UploadDatabaseClient;/,
  "createUploadedResources must allow callers to provide the active transaction client",
);

assert.match(
  helperSource,
  /const database = options\?\.dbClient \?\? db;/,
  "createUploadedResources should use the provided transaction client when present",
);

assert.match(
  helperSource,
  /export async function runUploadedResourceSideEffects/,
  "upload side effects should be callable after a save transaction commits",
);

const transactionIndex = routeSource.indexOf("const result = await db.transaction");
const createIndex = routeSource.indexOf("const uploadResult = await createUploadedResources");
const sideEffectsIndex = routeSource.indexOf(
  "await runUploadedResourceSideEffects(variant, result.data);",
);

assert.notEqual(transactionIndex, -1, "upload save should wrap receipt use in a transaction");
assert.notEqual(createIndex, -1, "upload resources should be created inside that transaction");
assert.notEqual(sideEffectsIndex, -1, "upload side effects should run after the transaction");
assert.ok(
  transactionIndex < createIndex,
  "the resource inserts must be part of the receipt transaction",
);
assert.ok(
  createIndex < sideEffectsIndex,
  "cache invalidation and moderation review should run only after commit",
);

const routeTransactionBlock = routeSource.slice(transactionIndex, sideEffectsIndex);

assert.match(
  routeTransactionBlock,
  /dbClient: transaction/,
  "createUploadedResources must receive the active transaction client",
);
assert.match(
  routeTransactionBlock,
  /runSideEffects: false/,
  "side effects must be deferred until after the transaction commits",
);
assert.match(
  routeTransactionBlock,
  /throw new UploadSaveValidationError\(uploadResult\.error\);/,
  "validation failures from createUploadedResources must throw to roll back consumed receipts",
);
assert.doesNotMatch(
  routeSource,
  /const results = await db\.transaction[\s\S]*?const result = await createUploadedResources/,
  "receipts must not be consumed in one transaction and saved in a later non-transactional step",
);

console.log("upload receipt atomicity tests passed");
