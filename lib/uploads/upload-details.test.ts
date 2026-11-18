import assert from "node:assert/strict";
import test from "node:test";
import { parseUploadBatch } from "./upload-details";

test("top-level fields are the defaults for every result", () => {
    const parsed = parseUploadBatch(
        {
            results: [{ receiptId: " a " }, { receiptId: "b" }],
            courseId: "course-1",
            examType: "CAT_1",
            slot: " A1 ",
            year: "2024",
            semester: "FALL",
            campus: "VELLORE",
            hasAnswerKey: true,
        },
        "Past Papers",
        8,
    );
    assert.deepEqual(parsed.items, [
        {
            receiptId: "a",
            metadata: {
                courseId: "course-1",
                examType: "CAT_1",
                slot: "A1",
                year: "2024",
                semester: "FALL",
                campus: "VELLORE",
                hasAnswerKey: true,
            },
        },
        {
            receiptId: "b",
            metadata: {
                courseId: "course-1",
                examType: "CAT_1",
                slot: "A1",
                year: "2024",
                semester: "FALL",
                campus: "VELLORE",
                hasAnswerKey: true,
            },
        },
    ]);
});

test("a result's details override the defaults field by field", () => {
    const parsed = parseUploadBatch(
        {
            results: [
                { receiptId: "a", details: { examType: "FAT", hasAnswerKey: false, campus: null } },
                { receiptId: "b", details: { courseId: "course-2", year: "2023", slot: "" } },
                { receiptId: "c", details: null },
            ],
            courseId: "course-1",
            examType: "CAT_1",
            slot: "A1",
            year: "2024",
            campus: "CHENNAI",
            hasAnswerKey: true,
        },
        "Past Papers",
        8,
    );
    assert.ok(parsed.items);
    const [first, second, third] = parsed.items.map((item) => item.metadata);
    assert.deepEqual(first, {
        courseId: "course-1",
        examType: "FAT",
        slot: "A1",
        year: "2024",
        semester: null,
        campus: null,
        hasAnswerKey: false,
    });
    assert.deepEqual(second, {
        courseId: "course-2",
        examType: "CAT_1",
        slot: "",
        year: "2023",
        semester: null,
        campus: "CHENNAI",
        hasAnswerKey: true,
    });
    assert.equal(third.courseId, "course-1");
    assert.equal(third.examType, "CAT_1");
});

test("results without any details have no metadata", () => {
    const parsed = parseUploadBatch({ results: [{ receiptId: "a" }] }, "Notes", 8);
    assert.deepEqual(parsed.items?.[0].metadata, {
        courseId: null,
        examType: null,
        slot: "",
        year: "",
        semester: null,
        campus: null,
        hasAnswerKey: false,
    });
});

test("enum values are validated for the defaults and for each result", () => {
    assert.deepEqual(
        parseUploadBatch({ results: [{ receiptId: "a" }], examType: "EXAM" }, "Past Papers", 8),
        { error: "Exam type is invalid." },
    );
    assert.deepEqual(
        parseUploadBatch(
            {
                results: [
                    { receiptId: "a", details: { semester: "FALL" } },
                    { receiptId: "b", details: { semester: "SPRING" } },
                ],
            },
            "Past Papers",
            8,
        ),
        { error: "Paper 2: Semester is invalid." },
    );
    assert.deepEqual(
        parseUploadBatch(
            { results: [{ receiptId: "a", details: { campus: "MOON" } }] },
            "Notes",
            8,
        ),
        { error: "Note 1: Campus is invalid." },
    );
    assert.deepEqual(
        parseUploadBatch({ results: [{ receiptId: "a", details: "FAT" }] }, "Past Papers", 8),
        { error: "Paper 1: details are invalid." },
    );
});

test("batches need 1 to the maximum number of distinct receipts", () => {
    const error = { error: "Upload batches must contain 1-2 valid receipts." };
    assert.deepEqual(parseUploadBatch({}, "Notes", 2), error);
    assert.deepEqual(parseUploadBatch({ results: [] }, "Notes", 2), error);
    assert.deepEqual(parseUploadBatch({ results: [{ receiptId: " " }] }, "Notes", 2), error);
    assert.deepEqual(parseUploadBatch({ results: ["a"] }, "Notes", 2), error);
    assert.deepEqual(
        parseUploadBatch({ results: [{ receiptId: "a" }, { receiptId: "a" }] }, "Notes", 2),
        error,
    );
    assert.deepEqual(
        parseUploadBatch(
            { results: [{ receiptId: "a" }, { receiptId: "b" }, { receiptId: "c" }] },
            "Notes",
            2,
        ),
        error,
    );
});
