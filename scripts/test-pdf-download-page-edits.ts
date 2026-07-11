import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { preparePdfDownloadBlob } from "../lib/downloads/browser-downloads";
import type { PdfPageEdits } from "../lib/pdf/page-edits";

async function createSourcePdf() {
  const document = await PDFDocument.create();
  document.addPage([200, 300]);
  document.addPage([400, 300]);
  document.addPage([600, 300]);

  return document.save();
}

const pageEdits: PdfPageEdits = {
  pageOrder: [2, 0, 1],
  pageRotations: {
    "2": 180,
    "0": 90,
  },
};

async function main() {
  const sourceBytes = await createSourcePdf();
  const sourceBlob = new Blob([sourceBytes], { type: "application/pdf" });

  assert.equal(
    await preparePdfDownloadBlob(sourceBlob, null),
    sourceBlob,
    "Unedited PDFs should keep the original download blob",
  );

  const editedBlob = await preparePdfDownloadBlob(sourceBlob, pageEdits);
  const editedDocument = await PDFDocument.load(await editedBlob.arrayBuffer());

  assert.equal(editedDocument.getPageCount(), 3);

  const firstPage = editedDocument.getPage(0);
  assert.equal(firstPage.getWidth(), 600);
  assert.equal(firstPage.getRotation().angle, 180);

  const secondPage = editedDocument.getPage(1);
  assert.equal(secondPage.getWidth(), 200);
  assert.equal(secondPage.getRotation().angle, 90);

  const thirdPage = editedDocument.getPage(2);
  assert.equal(thirdPage.getWidth(), 400);
  assert.equal(thirdPage.getRotation().angle, 0);

  console.log("PDF download page edits are preserved.");
}

void main();
