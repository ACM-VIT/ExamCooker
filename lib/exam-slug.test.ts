import assert from "node:assert/strict";
import test from "node:test";
import { examSlugToType, examTypeLabel, examTypeToSlug, parseExamTypeInput } from "@/lib/exam-slug";
import { parsePastPaperSearchParams } from "@/lib/past-paper-search-params";
import { resolveCommandIntent } from "@/lib/command/intent";

test("ReCAT labels and slugs round-trip without matching regular CAT exams", () => {
  const exams = [
    { type: "RECAT_1", label: "ReCAT-1", slug: "recat-1" },
    { type: "RECAT_2", label: "ReCAT-2", slug: "recat-2" },
  ] as const;

  for (const { type, label, slug } of exams) {
    assert.equal(examTypeLabel(type), label);
    assert.equal(examTypeToSlug(type), slug);
    assert.equal(examSlugToType(slug), type);
    assert.equal(parseExamTypeInput(label), type);
    assert.equal(parseExamTypeInput(label.replace("-", "")), type);
    assert.equal(resolveCommandIntent(`CSE1001 ${label} papers`).examType, type);
  }

  assert.deepEqual(parsePastPaperSearchParams({ exam: "recat-1,cat-1,recat-2,cat-2" }).examTypes, [
    "RECAT_1",
    "CAT_1",
    "RECAT_2",
    "CAT_2",
  ]);
});
