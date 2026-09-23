import assert from "node:assert/strict";
import {
  hasSubjectCodePrefixCollision,
  hasSyllabusCodePrefixCollision,
} from "../lib/course-code-prefix";

const rows = (...names: string[]) =>
  names.map((name, index) => ({ id: String(index), name }));

assert.equal(
  hasSyllabusCodePrefixCollision(
    rows("CS_101_999_SOURCE"),
    rows("CS_102_000_LEGACY"),
    "CS_101",
    "CS_102",
  ),
  true,
  "Exact source and destination syllabus prefixes must collide",
);
assert.equal(
  hasSyllabusCodePrefixCollision(
    rows("CS_101_999_SOURCE"),
    rows("CSX102_000_LEGACY", "CS_102X000_LEGACY"),
    "CS_101",
    "CS_102",
  ),
  false,
  "SQL underscore wildcard matches must not count as exact syllabus prefixes",
);
assert.equal(
  hasSyllabusCodePrefixCollision(
    rows("CSX101_999_SOURCE"),
    rows("CS_102_000_LEGACY"),
    "CS_101",
    "CS_102",
  ),
  false,
  "A syllabus collision requires an exact source-linked row",
);

assert.equal(
  hasSubjectCodePrefixCollision(
    rows("CS_101 - Z Source Resources"),
    rows("CS_102 - A Legacy Resources"),
    "CS_101",
    "CS_102",
  ),
  true,
  "Exact source and destination Subject prefixes must collide",
);
assert.equal(
  hasSubjectCodePrefixCollision(
    rows("CS_101 - Z Source Resources"),
    rows("CSX102 - A Legacy Resources"),
    "CS_101",
    "CS_102",
  ),
  false,
  "SQL underscore wildcard matches must not count as exact Subject prefixes",
);
assert.equal(
  hasSubjectCodePrefixCollision(
    rows("CSX101 - Z Source Resources"),
    rows("CS_102 - A Legacy Resources"),
    "CS_101",
    "CS_102",
  ),
  false,
  "A Subject collision requires an exact source-linked row",
);

console.log("Course code prefix collision checks passed.");
