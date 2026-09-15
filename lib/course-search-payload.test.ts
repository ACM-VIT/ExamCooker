import assert from "node:assert/strict";
import { test } from "node:test";
import { packCourseSearch, unpackCourseSearch } from "./course-search-payload";
import { createCourseFuse } from "./course-search-fuse";

const courses = [
  { id: "db-a", code: "BMAT202L", title: "Differential Equations", paperCount: 250,
    noteCount: 12, aliases: ["MDE", "Mathematics II"], syllabusId: "syllabus-a" },
  { id: "db-b", code: "BCSE001L", title: "Digital Forensics", paperCount: 0,
    noteCount: 0, aliases: ["DF", "Forensic science"], syllabusId: null },
  { id: "db-c", code: "BMAT201L", title: "Multivariable Calculus", paperCount: 18,
    noteCount: 0, aliases: [], syllabusId: "" },
  { id: "db-d", code: "BCSE002L", title: "Théorie & 日本語 <script>", paperCount: 0,
    noteCount: 4 },
];

test("search transport keeps ordering, aliases, counts and syllabus destinations", () => {
  const wire = JSON.parse(JSON.stringify(packCourseSearch(courses)));
  const decoded = unpackCourseSearch(wire);
  assert.deepEqual(decoded, courses.map(({ id: _id, ...course }) => ({
    ...course, aliases: course.aliases ?? [], syllabusId: course.syllabusId ?? null,
  })));
  assert.equal(JSON.stringify(wire).includes("db-a"), false);
  assert.equal(wire[1].length, 5, "Absent syllabus IDs need no wire field");
  assert.equal(decoded[1].paperCount, 0, "Empty courses must remain searchable");
  assert.deepEqual(unpackCourseSearch(packCourseSearch([])), []);
});

test("packing does not change fuzzy relevance, aliases or short-prefix results", () => {
  const before = createCourseFuse(courses);
  const after = createCourseFuse(unpackCourseSearch(packCourseSearch(courses)));
  for (const query of ["BMAT202L", "mde", "diffrential", "forensic science", "mu", "日本語", "no-match-xyz"]) {
    const results = (index: typeof before | typeof after) => index.search(query)
      .map(({ item, score, refIndex }) => ({ code: item.code, score, refIndex }));
    assert.deepEqual(results(after), results(before), query);
  }
});
