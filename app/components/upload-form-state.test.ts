import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialUploadFormState,
  isConvertingImages,
  uploadFormReducer,
  type UploadFormAction,
  type UploadFormState,
} from "./upload-form-state";

const file = (name: string) => new File(["x"], name);
const run = (actions: UploadFormAction[], state: UploadFormState = initialUploadFormState) =>
  actions.reduce(uploadFormReducer, state);

test("a PDF dropped while pages convert is rejected instead of being overwritten", () => {
  const image = file("page.jpg");
  const pdf = file("bundle.pdf");
  const state = run([
    { type: "conversion_started", conversionId: 1 },
    { type: "add_pdfs", files: [file("other.pdf")], titles: ["other"] },
    { type: "conversion_succeeded", conversionId: 1, images: [image], pdf, fallbackTitle: "bundle" },
  ]);
  assert.deepEqual(state.files, [pdf]);
  assert.deepEqual(state.imageBundleFiles, [image]);
  assert.equal(isConvertingImages(state), false);
});

test("files cannot be removed while a conversion would replace them", () => {
  const first = run([
    { type: "conversion_started", conversionId: 1 },
    { type: "conversion_succeeded", conversionId: 1, images: [file("a.jpg")], pdf: file("a.pdf"), fallbackTitle: "a" },
    { type: "conversion_started", conversionId: 2 },
  ]);
  const removed = uploadFormReducer(first, { type: "remove_file", index: 0, variant: "Past Papers" });
  assert.equal(removed, first);
});

test("a title typed during conversion is kept", () => {
  const images = [file("a.jpg")];
  const bundled = run([
    { type: "conversion_started", conversionId: 1 },
    { type: "conversion_succeeded", conversionId: 1, images, pdf: file("a.pdf"), fallbackTitle: "a-bundle" },
    { type: "conversion_started", conversionId: 2 },
    { type: "update_title", index: 0, value: "CAT 1 answers" },
    {
      type: "conversion_succeeded",
      conversionId: 2,
      images: [...images, file("b.jpg")],
      pdf: file("b.pdf"),
      fallbackTitle: "a-bundle",
    },
  ]);
  assert.deepEqual(bundled.fileTitles, ["CAT 1 answers"]);
  assert.equal(bundled.imageBundleFiles.length, 2);
});

test("only the current conversion can finish", () => {
  const state = run([
    { type: "conversion_started", conversionId: 2 },
    { type: "conversion_failed", conversionId: 1 },
    { type: "conversion_succeeded", conversionId: 1, images: [file("a.jpg")], pdf: file("a.pdf"), fallbackTitle: "a" },
  ]);
  assert.equal(state.conversionId, 2);
  assert.deepEqual(state.files, []);
});

test("removing the last bundled file leaves image-bundle mode and keeps titles aligned", () => {
  const state = run([
    { type: "conversion_started", conversionId: 1 },
    { type: "conversion_succeeded", conversionId: 1, images: [file("a.jpg")], pdf: file("a.pdf"), fallbackTitle: "a" },
    { type: "remove_file", index: 0, variant: "Past Papers" },
  ]);
  assert.equal(state.isImageBundleMode, false);
  assert.deepEqual(state.imageBundleFiles, []);
  assert.deepEqual(state.files, []);
  assert.deepEqual(state.fileTitles, []);
});

test("PDFs cannot be added to an image bundle", () => {
  const bundled = run([
    { type: "conversion_started", conversionId: 1 },
    { type: "conversion_succeeded", conversionId: 1, images: [file("a.jpg")], pdf: file("a.pdf"), fallbackTitle: "a" },
  ]);
  assert.equal(uploadFormReducer(bundled, { type: "add_pdfs", files: [file("b.pdf")], titles: ["b"] }), bundled);
});
