import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const correctionSafetySource = readFileSync(
  "lib/ai/content-correction-safety.ts",
  "utf8",
);
const moderatorActionsSource = readFileSync(
  "app/actions/moderator-actions.ts",
  "utf8",
);
const moderationReviewSource = readFileSync("lib/ai/moderation-review.ts", "utf8");

assert.match(
  correctionSafetySource,
  /if \(field === "slot"\) return suggestion\.slot !== null;/,
  "slot corrections must not be applicable when the AI suggestion is null",
);

const deleteItemIndex = moderatorActionsSource.indexOf("export async function deleteItem");
const runReviewIndex = moderatorActionsSource.indexOf(
  "export async function runAiModerationReview",
);
assert.notEqual(deleteItemIndex, -1, "deleteItem action should exist");
assert.notEqual(runReviewIndex, -1, "runAiModerationReview action should exist");

const deleteItemSource = moderatorActionsSource.slice(deleteItemIndex, runReviewIndex);

assert.match(
  deleteItemSource,
  /eq\(note\.isClear, false\)/,
  "note deletion must be restricted to pending moderation rows",
);
assert.match(
  deleteItemSource,
  /eq\(pastPaper\.isClear, false\)/,
  "past paper deletion must be restricted to pending moderation rows",
);
assert.match(
  deleteItemSource,
  /isNull\(pastPaper\.moderationArchivedAt\)/,
  "past paper deletion must ignore archived moderation rows",
);
assert.match(
  deleteItemSource,
  /eq\(pastPaper\.questionPaperId, id\)/,
  "past paper deletion must block rows that still have linked answer keys",
);
assert.match(
  deleteItemSource,
  /throw new Error\("Unlink the answer key before deleting this paper\."\);/,
  "linked answer keys should produce an explicit delete failure",
);

const runReviewSource = moderatorActionsSource.slice(runReviewIndex);

assert.match(
  runReviewSource,
  /eq\(note\.isClear, false\)/,
  "AI moderation review should only run from the pending note queue",
);
assert.match(
  runReviewSource,
  /eq\(pastPaper\.isClear, false\)/,
  "AI moderation review should only run from the pending past-paper queue",
);

assert.match(
  moderationReviewSource,
  /input\.autoApprove !== false &&\s+!resource\.isClear &&\s+issues\.length === 0 &&\s+duplicate === null;/,
  "automatic AI approval must never apply suggestions to an already-published resource",
);

console.log("moderation data-integrity guard tests passed");
