import assert from "node:assert/strict";
import test from "node:test";
import { getPreviewDocument, getPreviewSourceKey, PREVIEW_DOCUMENT } from "./preview-source";

test("each previewable key maps to one document and back", () => {
  for (const [key, previewDocument] of [
    ["past-papers/cmoeqf27601vqa8v3nk8b8gdf/paper.pdf", "past-papers/cmoeqf27601vqa8v3nk8b8gdf"],
    ["91ee5165-65b3-468d-a736-b57eee54fc03.pdf", "91ee5165-65b3-468d-a736-b57eee54fc03"],
  ]) {
    assert.equal(getPreviewDocument(key), previewDocument);
    assert.equal(getPreviewSourceKey(previewDocument), key);
    assert.match(previewDocument, new RegExp(`^${PREVIEW_DOCUMENT}$`));
  }
});

test("other keys have no preview", () => {
  for (const key of [
    "past-papers/short/paper.pdf",
    "past-papers/cmoeqf27601vqa8v3nk8b8gdf/other.pdf",
    "91EE5165-65B3-468D-A736-B57EEE54FC03.pdf",
    "notes/91ee5165-65b3-468d-a736-b57eee54fc03.pdf",
    "uploads/1755409749964_past_paper.pdf",
    "91ee5165-65b3-468d-a736-b57eee54fc03.pdf.pdf",
    "_previews/v1/91ee5165-65b3-468d-a736-b57eee54fc03.pdf",
  ]) {
    assert.equal(getPreviewDocument(key), null, key);
  }
  for (const path of ["new-upload", "past-papers/x/../y", "91ee5165-65b3-468d-a736-b57eee54fc03/p0"]) {
    assert.doesNotMatch(path, new RegExp(`^${PREVIEW_DOCUMENT}$`), path);
  }
});
