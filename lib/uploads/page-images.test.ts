import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HEIC_UNSUPPORTED_MESSAGE,
  MAX_UPLOAD_PDF_BYTES,
  PAGE_ENCODING_STEPS,
  estimatePdfBytes,
  fitWithinEdge,
  fitsUploadLimit,
  formatMegabytes,
  isHeicLike,
  moveById,
  pickEncodingStep,
  removeById,
  rotateClockwise,
  rotatedSize,
  unreadablePhotoMessage,
} from "./page-images";

const MB = 1024 * 1024;

test("photos are scaled so the long edge fits, keeping the aspect ratio", () => {
  assert.deepEqual(fitWithinEdge(4032, 3024, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithinEdge(3024, 4032, 2000), { width: 1500, height: 2000 });
  assert.deepEqual(fitWithinEdge(4000, 1, 2000), { width: 2000, height: 1 });
});

test("small photos are not scaled up", () => {
  assert.deepEqual(fitWithinEdge(1200, 900, 2000), { width: 1200, height: 900 });
  assert.throws(() => fitWithinEdge(0, 10, 2000), RangeError);
});

test("rotation turns clockwise through the four positions and swaps the size sideways", () => {
  assert.equal(rotateClockwise(0), 90);
  assert.equal(rotateClockwise(90), 180);
  assert.equal(rotateClockwise(270), 0);
  assert.deepEqual(rotatedSize(2000, 1500, 90), { width: 1500, height: 2000 });
  assert.deepEqual(rotatedSize(2000, 1500, 180), { width: 2000, height: 1500 });
  assert.deepEqual(rotatedSize(2000, 1500, 270), { width: 1500, height: 2000 });
});

test("pages move by id and stop at the ends", () => {
  const pages = ["a", "b", "c"].map((id) => ({ id }));
  const ids = (items: { id: string }[]) => items.map((item) => item.id).join("");
  assert.equal(ids(moveById(pages, "a", 1)), "bac");
  assert.equal(ids(moveById(pages, "c", -1)), "acb");
  assert.equal(ids(moveById(pages, "a", -1)), "abc");
  assert.equal(ids(moveById(pages, "c", 5)), "abc");
  assert.equal(ids(moveById(pages, "missing", 1)), "abc");
  assert.equal(ids(removeById(pages, "b")), "ac");
  assert.equal(ids(pages), "abc", "the input list is not changed");
});

test("the PDF estimate adds overhead to the page images", () => {
  const estimate = estimatePdfBytes([MB, MB]);
  assert.ok(estimate > 2 * MB);
  assert.ok(estimate < 2 * MB + 64 * 1024);
  assert.equal(fitsUploadLimit(10 * MB), true);
  assert.equal(fitsUploadLimit(MAX_UPLOAD_PDF_BYTES), false, "leaves a margin below the limit");
});

test("the encoding step is the first one expected to fit", () => {
  assert.equal(pickEncodingStep(5 * MB), 0);
  assert.equal(pickEncodingStep(30 * MB), 1);
  assert.equal(pickEncodingStep(45 * MB), 2);
  assert.equal(pickEncodingStep(70 * MB), 3);
  assert.equal(pickEncodingStep(200 * MB), -1);
});

test("encoding steps get smaller and stay in the requested range", () => {
  for (let index = 1; index < PAGE_ENCODING_STEPS.length; index += 1) {
    const previous = PAGE_ENCODING_STEPS[index - 1];
    const step = PAGE_ENCODING_STEPS[index];
    assert.ok(step.sizeRatio < previous.sizeRatio);
    assert.ok(step.maxEdge <= previous.maxEdge && step.quality <= previous.quality);
  }
  assert.equal(PAGE_ENCODING_STEPS[0].maxEdge, 2000);
  assert.equal(PAGE_ENCODING_STEPS[0].quality, 0.8);
});

test("HEIC photos get the export message; other unreadable photos are named", () => {
  assert.equal(isHeicLike({ name: "IMG_0001.HEIC", type: "" }), true);
  assert.equal(isHeicLike({ name: "photo", type: "image/heif" }), true);
  assert.equal(isHeicLike({ name: "page.jpg", type: "image/jpeg" }), false);
  assert.equal(unreadablePhotoMessage({ name: "IMG_1.heic", type: "image/heic" }), HEIC_UNSUPPORTED_MESSAGE);
  assert.match(unreadablePhotoMessage({ name: "broken.png", type: "image/png" }), /broken\.png/);
});

test("sizes are shown in megabytes", () => {
  assert.equal(formatMegabytes(1.25 * MB), "1.3 MB");
  assert.equal(formatMegabytes(24.6 * MB), "25 MB");
});
