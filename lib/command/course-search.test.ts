import assert from "node:assert/strict";
import test from "node:test";
import { getCourseSearchText, scoreCourse } from "./course-search";
import { resolveCommandIntent } from "./intent";

test("local ReCAT searches retain their course match and exam intent", () => {
  const course = { code: "CSE1001", title: "Problem Solving", aliases: [] };

  for (const [query, examType] of [
    ["CSE1001 ReCAT-1 papers", "RECAT_1"],
    ["CSE1001 Re CAT 2 papers", "RECAT_2"],
    ["CSE1001 recat2 papers", "RECAT_2"],
    ["CSE1001 CAT-1 papers", "CAT_1"],
  ] as const) {
    assert.equal(scoreCourse(course, getCourseSearchText(query), new Set()), 0);
    assert.equal(resolveCommandIntent(query).examType, examType);
  }
});
