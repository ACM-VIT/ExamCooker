import assert from "node:assert/strict";
import {
    replaceOwnedSubjectCodePrefix,
    replaceOwnedSyllabusCodePrefix,
} from "@/lib/course-code-owned-prefix";

const knownCourseCodes = ["FOO", "FOO_BAR", "FOO-BAR", "A_B", "A_B_C"];

assert.equal(
    replaceOwnedSyllabusCodePrefix({
        name: "FOO_Syllabus.pdf",
        currentCode: "FOO",
        nextCode: "FOOX",
        knownCourseCodes,
    }),
    "FOOX_Syllabus.pdf",
);

assert.equal(
    replaceOwnedSyllabusCodePrefix({
        name: "FOO_BAR_Syllabus.pdf",
        currentCode: "FOO",
        nextCode: "FOOX",
        knownCourseCodes,
    }),
    null,
);

assert.equal(
    replaceOwnedSyllabusCodePrefix({
        name: "A_B_C_Syllabus.pdf",
        currentCode: "A_B",
        nextCode: "A_BX",
        knownCourseCodes,
    }),
    null,
);

assert.equal(
    replaceOwnedSubjectCodePrefix({
        name: "FOO - Resources",
        currentCode: "FOO",
        nextCode: "FOOX",
        knownCourseCodes,
    }),
    "FOOX - Resources",
);

assert.equal(
    replaceOwnedSubjectCodePrefix({
        name: "FOO-BAR - Resources",
        currentCode: "FOO",
        nextCode: "FOOX",
        knownCourseCodes,
    }),
    null,
);

assert.equal(
    replaceOwnedSubjectCodePrefix({
        name: "FOO",
        currentCode: "FOO",
        nextCode: "FOOX",
        knownCourseCodes,
    }),
    "FOOX",
);

console.log("course code owned-prefix regression checks passed");
