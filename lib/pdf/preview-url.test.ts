import assert from "node:assert/strict";
import test from "node:test";
import { getPdfFirstPagePreviewUrl } from "./preview-url";

const PAPER = "https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/cmoeqf27601vqa8v3nk8b8gdf/paper.pdf";
const BASE = "https://ec-assets.acmvit.in";

test("papers on the asset host preview the first displayed page", () => {
  assert.equal(getPdfFirstPagePreviewUrl(PAPER, null, BASE),
    `${BASE}/_preview/v1/past-papers/cmoeqf27601vqa8v3nk8b8gdf/p0-r0.webp`);
  assert.equal(getPdfFirstPagePreviewUrl(PAPER, { pageOrder: [2, 0, 1], pageRotations: { "2": 90, "0": 180 } }, BASE),
    `${BASE}/_preview/v1/past-papers/cmoeqf27601vqa8v3nk8b8gdf/p2-r90.webp`);
  assert.equal(getPdfFirstPagePreviewUrl(PAPER, { pageRotations: { "0": 270 } }, BASE),
    `${BASE}/_preview/v1/past-papers/cmoeqf27601vqa8v3nk8b8gdf/p0-r270.webp`);
});

test("papers uploaded before per-paper folders preview from their root key", () => {
  const legacy = "https://examcookerprodsi.blob.core.windows.net/exam-assets/91ee5165-65b3-468d-a736-b57eee54fc03.pdf";
  assert.equal(getPdfFirstPagePreviewUrl(legacy, null, BASE),
    `${BASE}/_preview/v1/91ee5165-65b3-468d-a736-b57eee54fc03/p0-r0.webp`);
  assert.equal(getPdfFirstPagePreviewUrl(legacy, { pageRotations: { "0": 90 } }, BASE),
    `${BASE}/_preview/v1/91ee5165-65b3-468d-a736-b57eee54fc03/p0-r90.webp`);
});

test("other documents and deployments have no preview", () => {
  assert.equal(getPdfFirstPagePreviewUrl(PAPER, null, ""), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://examcookerprodsi.blob.core.windows.net/exam-assets/notes/abc/note.pdf", null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://ec-syllabus.acmvit.in/files/syllabi/BMAT101L_x.pdf", null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl(`${PAPER}?sig=private`, null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://examcookerprodsi.blob.core.windows.net/exam-assets/uploads/1755409749964_past_paper.pdf", null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://examcookerprodsi.blob.core.windows.net/exam-assets/notes/91ee5165-65b3-468d-a736-b57eee54fc03.pdf", null, BASE), null);
});
