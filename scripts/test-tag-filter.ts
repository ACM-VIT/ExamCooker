import assert from "node:assert/strict";
import {
  matchesLiteralTagName,
  normalizeTagFilterNames,
} from "../lib/cli/tag-filter";

assert.deepEqual(normalizeTagFilterNames(["%", "_", " % ", ""]), ["%", "_"]);
assert.equal(matchesLiteralTagName("%", "%"), true);
assert.equal(matchesLiteralTagName("Exam_1", "exam_1"), true);
assert.equal(matchesLiteralTagName("Exam_1", "ExamA1"), false);
assert.equal(matchesLiteralTagName("Exam_1", "%"), false);

console.log("Literal tag filter tests passed");
