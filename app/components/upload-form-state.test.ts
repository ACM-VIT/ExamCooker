import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_FILES_PER_UPLOAD,
  MAX_PAGES_PER_PAPER,
  buildNotesSaveBody,
  buildPastPaperSaveBody,
  countProcessingPages,
  createInitialUploadFormState,
  getPaperPages,
  getPaperProblems,
  getPaperTitle,
  isProcessingPages,
  remainingPaperSlots,
  uploadFormReducer,
  type UploadFormAction,
  type UploadFormState,
} from "./upload-form-state";

const file = (name: string) => new File(["x"], name);
const processed = { blob: new Blob(["jpeg"]), width: 1500, height: 2000, thumbnail: new Blob(["thumb"]) };
const initial = createInitialUploadFormState("p1");
const run = (actions: UploadFormAction[], state: UploadFormState = initial) =>
  actions.reduce(uploadFormReducer, state);
const page = (id: string) => ({ id, name: `${id}.jpg`, source: file(`${id}.jpg`) });
const pageIds = (state: UploadFormState, paperIndex = 0) =>
  getPaperPages(state.papers[paperIndex]).map((item) => item.id).join(",");

test("a new paper starts with the previous paper's details but no title or file", () => {
  const state = run([
    { type: "set_paper_field", paperId: "p1", field: "courseId", value: "course-1" },
    { type: "set_paper_field", paperId: "p1", field: "examType", value: "CAT_1" },
    { type: "set_paper_field", paperId: "p1", field: "year", value: "2024" },
    { type: "set_paper_field", paperId: "p1", field: "hasAnswerKey", value: true },
    { type: "set_paper_title", paperId: "p1", value: "First" },
    { type: "attach_pdfs", paperId: "p1", pdfs: [{ id: "x", file: file("a.pdf"), title: "a" }] },
    { type: "add_paper", paperId: "p2" },
    { type: "set_paper_field", paperId: "p2", field: "slot", value: "B1" },
  ]);
  const [first, second] = state.papers;
  assert.equal(second.title, "");
  assert.equal(second.source.kind, "none");
  assert.deepEqual(second.details, { ...first.details, slot: "B1" });
  assert.equal(first.details.slot, "", "editing the copy leaves the original alone");
});

test("papers are capped at the server batch limit", () => {
  let state = initial;
  for (let index = 2; index <= MAX_FILES_PER_UPLOAD + 2; index += 1) {
    state = uploadFormReducer(state, { type: "add_paper", paperId: `p${index}` });
  }
  assert.equal(state.papers.length, MAX_FILES_PER_UPLOAD);
  assert.equal(remainingPaperSlots(state), 0);
});

test("several PDFs dropped on a paper fill it and add papers after it with its details", () => {
  const state = run([
    { type: "add_paper", paperId: "p2" },
    { type: "set_paper_field", paperId: "p1", field: "examType", value: "FAT" },
    {
      type: "attach_pdfs",
      paperId: "p1",
      pdfs: [
        { id: "x1", file: file("one.pdf"), title: "one" },
        { id: "x2", file: file("two.pdf"), title: "two" },
      ],
    },
  ]);
  assert.deepEqual(state.papers.map((paper) => paper.id), ["p1", "x2", "p2"]);
  assert.equal(state.papers[0].title, "one");
  assert.equal(state.papers[1].details.examType, "FAT");
  assert.equal(state.papers[2].details.examType, "", "papers added earlier keep their details");
});

test("PDFs are rejected when they would go over the limit or onto photos", () => {
  const full = run(
    Array.from({ length: MAX_FILES_PER_UPLOAD - 1 }, (_, index): UploadFormAction => ({
      type: "add_paper",
      paperId: `p${index + 2}`,
    })),
  );
  const two = [
    { id: "x1", file: file("one.pdf"), title: "one" },
    { id: "x2", file: file("two.pdf"), title: "two" },
  ];
  assert.equal(uploadFormReducer(full, { type: "attach_pdfs", paperId: "p1", pdfs: two }), full);

  const withPhotos = run([{ type: "add_pages", paperId: "p1", pages: [page("a")] }]);
  assert.equal(uploadFormReducer(withPhotos, { type: "attach_pdfs", paperId: "p1", pdfs: two }), withPhotos);
});

test("photos cannot be added to a paper that has a PDF", () => {
  const withPdf = run([{ type: "attach_pdfs", paperId: "p1", pdfs: [{ id: "x", file: file("a.pdf"), title: "a" }] }]);
  assert.equal(uploadFormReducer(withPdf, { type: "add_pages", paperId: "p1", pages: [page("a")] }), withPdf);
});

test("pages process independently and a removed page's late result is dropped", () => {
  const state = run([
    { type: "add_pages", paperId: "p1", pages: [page("a"), page("b")] },
    { type: "page_processed", paperId: "p1", pageId: "a", processed },
    { type: "remove_page", paperId: "p1", pageId: "b" },
  ]);
  assert.equal(isProcessingPages(state), false);
  assert.equal(uploadFormReducer(state, { type: "page_processed", paperId: "p1", pageId: "b", processed }), state);
  assert.equal(pageIds(state), "a");
});

test("adding pages keeps pages already processed", () => {
  const state = run([
    { type: "add_pages", paperId: "p1", pages: [page("a")] },
    { type: "page_processed", paperId: "p1", pageId: "a", processed },
    { type: "add_pages", paperId: "p1", pages: [page("b")] },
  ]);
  const [first, second] = getPaperPages(state.papers[0]);
  assert.equal(first.processed, processed);
  assert.equal(second.processed, null);
  assert.equal(countProcessingPages(state), 1);
});

test("pages reorder, rotate, and the last removal empties the paper", () => {
  let state = run([
    { type: "add_pages", paperId: "p1", pages: [page("a"), page("b"), page("c")] },
    { type: "move_page", paperId: "p1", pageId: "c", delta: -1 },
    { type: "rotate_page", paperId: "p1", pageId: "a" },
    { type: "rotate_page", paperId: "p1", pageId: "a" },
  ]);
  assert.equal(pageIds(state), "a,c,b");
  assert.equal(getPaperPages(state.papers[0])[0].rotation, 180);

  state = run(
    ["a", "b", "c"].map((pageId): UploadFormAction => ({ type: "remove_page", paperId: "p1", pageId })),
    state,
  );
  assert.equal(state.papers[0].source.kind, "none");
});

test("a page that fails to decode is removed", () => {
  const state = run([
    { type: "add_pages", paperId: "p1", pages: [page("a")] },
    { type: "page_failed", paperId: "p1", pageId: "a" },
  ]);
  assert.equal(state.papers[0].source.kind, "none");
});

test("a paper takes at most the page limit", () => {
  const pages = Array.from({ length: MAX_PAGES_PER_PAPER + 1 }, (_, index) => page(`p${index}`));
  assert.equal(uploadFormReducer(initial, { type: "add_pages", paperId: "p1", pages }), initial);
});

test("removing the only paper leaves an empty one with the same details", () => {
  const state = run([
    { type: "set_paper_field", paperId: "p1", field: "year", value: "2023" },
    { type: "attach_pdfs", paperId: "p1", pdfs: [{ id: "x", file: file("a.pdf"), title: "a" }] },
    { type: "remove_paper", paperId: "p1", replacementId: "p9" },
  ]);
  assert.equal(state.papers.length, 1);
  assert.equal(state.papers[0].id, "p9");
  assert.equal(state.papers[0].source.kind, "none");
  assert.equal(state.papers[0].details.year, "2023");
});

test("problems name papers without files or with pages still processing", () => {
  const state = run([
    { type: "add_paper", paperId: "p2" },
    { type: "add_pages", paperId: "p2", pages: [page("a")] },
  ]);
  assert.deepEqual(getPaperProblems(state.papers), [
    "Paper 1 has no PDF or photos yet.",
    "Paper 2 still has pages processing.",
  ]);
  const ready = uploadFormReducer(state, { type: "page_processed", paperId: "p2", pageId: "a", processed });
  assert.deepEqual(getPaperProblems(ready.papers.slice(1)), []);
});

test("the save body carries each paper's own details", () => {
  const state = run([
    { type: "set_paper_field", paperId: "p1", field: "courseId", value: "c1" },
    { type: "set_paper_field", paperId: "p1", field: "semesterVal", value: "FALL" },
    { type: "add_paper", paperId: "p2" },
    { type: "set_paper_field", paperId: "p2", field: "examType", value: "CAT_2" },
    { type: "set_paper_field", paperId: "p2", field: "campusVal", value: "AP" },
  ]);
  assert.deepEqual(buildPastPaperSaveBody(state.papers, ["r1", "r2"]), {
    variant: "Past Papers",
    results: [
      {
        receiptId: "r1",
        details: {
          courseId: "c1",
          examType: null,
          slot: null,
          year: null,
          semester: "FALL",
          campus: null,
          hasAnswerKey: false,
        },
      },
      {
        receiptId: "r2",
        details: {
          courseId: "c1",
          examType: "CAT_2",
          slot: null,
          year: null,
          semester: "FALL",
          campus: "AP",
          hasAnswerKey: false,
        },
      },
    ],
  });
  assert.throws(() => buildPastPaperSaveBody(state.papers, ["r1"]));
});

test("notes keep several PDFs with shared details", () => {
  const state = run([
    { type: "set_note_field", field: "courseId", value: "c1" },
    {
      type: "add_notes",
      notes: [
        { id: "n1", file: file("a.pdf"), title: "a" },
        { id: "n2", file: file("b.pdf"), title: "b" },
      ],
    },
    { type: "set_note_title", noteId: "n2", value: "Unit 2" },
    { type: "remove_note", noteId: "n1" },
  ]);
  assert.deepEqual(state.notes.map((note) => note.title), ["Unit 2"]);
  assert.deepEqual(buildNotesSaveBody(state.noteDetails, ["r1"]), {
    variant: "Notes",
    results: [{ receiptId: "r1" }],
    courseId: "c1",
    year: "",
    slot: "",
  });
  const tooMany = Array.from({ length: MAX_FILES_PER_UPLOAD }, (_, index) => ({
    id: `m${index}`,
    file: file(`${index}.pdf`),
    title: `${index}`,
  }));
  assert.equal(uploadFormReducer(state, { type: "add_notes", notes: tooMany }), state);
});

test("a paper's title falls back to its file name", () => {
  const state = run([
    { type: "attach_pdfs", paperId: "p1", pdfs: [{ id: "x", file: file("cat1.pdf"), title: "" }] },
    { type: "add_paper", paperId: "p2" },
    { type: "add_pages", paperId: "p2", pages: [page("IMG_1")] },
    { type: "add_paper", paperId: "p3" },
    { type: "add_paper", paperId: "p4" },
    { type: "add_pages", paperId: "p4", pages: [{ id: "s", name: "scan-1795032177264.jpg", source: file("s.jpg") }] },
  ]);
  assert.equal(getPaperTitle(state.papers[0], 0), "cat1");
  assert.equal(getPaperTitle(state.papers[3], 3), "Scanned paper");
  assert.equal(getPaperTitle(state.papers[1], 1), "IMG_1-pages");
  assert.equal(getPaperTitle(state.papers[2], 2), "Paper 3");
});
