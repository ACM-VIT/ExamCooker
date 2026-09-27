import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { init } from "@embedpdf/pdfium";
import { PdfiumNative } from "@embedpdf/engines/pdfium";
import { getEffectivePdfRotation } from "./render-rotation";
import { applyPdfPageEditsToBuffer, getPdfPageRenderEntry, getPdfPageDisplayEntries } from "./page-edits";
import { PDFIUM_WASM_URL } from "../generated/pdfium-wasm";

test("saved rotations and editor previews match actual PDFium pixels after reopening", async () => {
  const source = await PDFDocument.create();
  for (const rotation of [0, 90]) {
    const page = source.addPage([200, 300]);
    page.drawRectangle({ x: 10, y: 20, width: 30, height: 70, color: rgb(1, 0, 0) });
    page.drawRectangle({ x: 140, y: 220, width: 40, height: 60, color: rgb(0, 0, 1) });
    page.setRotation(degrees(rotation));
  }
  const bytes = await source.save();
  const buffer = Uint8Array.from(bytes).buffer;
  const engine = new PdfiumNative(await init({ wasmBinary: await readFile(`public${PDFIUM_WASM_URL}`) }));
  const fingerprint = (raw: { width: number; height: number; data: Uint8ClampedArray }) => ({
    width: raw.width, height: raw.height,
    pixels: createHash("sha256").update(raw.data).digest("hex"),
  });
  try {
    const original = await engine.openDocumentBuffer({ id: "original", content: buffer }, { normalizeRotation: true }).toPromise();
    const unrotated = fingerprint(await engine.renderPageRaw(original, original.pages[0], { rotation: 0 }).toPromise());
    for (const angle of [90, 180, 270] as const) {
      const edits = { pageOrder: [1, 0], pageRotations: { "0": angle, "1": 180 as const } };
      const changed = await applyPdfPageEditsToBuffer(buffer, edits);
      const reopened = await engine.openDocumentBuffer({ id: `changed-${angle}`, content: changed }, { normalizeRotation: true }).toPromise();
      for (const [displayIndex, originalIndex] of [1, 0].entries()) {
        const page = reopened.pages[displayIndex];
        const rotation = getEffectivePdfRotation(page.rotation, 0);
        const actual = fingerprint(await engine.renderPageRaw(reopened, page, { rotation }).toPromise());
        const expectedRotation = ((original.pages[originalIndex].rotation + edits.pageRotations[String(originalIndex) as "0" | "1"] / 90) % 4) as 0 | 1 | 2 | 3;
        const expected = fingerprint(await engine.renderPageRaw(original, original.pages[originalIndex], { rotation: expectedRotation }).toPromise());
        assert.deepEqual(actual, expected, "Viewer must render saved rotation, existing PDF rotation, and page order");
        if (originalIndex === 0) assert.notEqual(actual.pixels, unrotated.pixels);
      }
      // On reopening the fixer, its zero-delta preview must retain the saved
      // rotation. A further edit is relative to that baseline, not to zero.
      const entry = getPdfPageDisplayEntries(2, edits)[1];
      const preview = getPdfPageRenderEntry({ baselineEdits: edits, entry, totalPages: 2 });
      assert.equal(preview.rotation, 0);
      assert.equal(getEffectivePdfRotation(reopened.pages[preview.pageIndex].rotation, 0), angle / 90);
    }
    assert.equal(getEffectivePdfRotation(3, 1), 0, "Document rotation wraps after the intrinsic rotation");
  } finally {
    await engine.destroy().toPromise();
  }
});
