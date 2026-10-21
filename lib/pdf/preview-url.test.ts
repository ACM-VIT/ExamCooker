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

test("other documents and deployments have no preview", () => {
  assert.equal(getPdfFirstPagePreviewUrl(PAPER, null, ""), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://examcookerprodsi.blob.core.windows.net/exam-assets/notes/abc/note.pdf", null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl("https://ec-syllabus.acmvit.in/files/syllabi/BMAT101L_x.pdf", null, BASE), null);
  assert.equal(getPdfFirstPagePreviewUrl(`${PAPER}?sig=private`, null, BASE), null);
});
