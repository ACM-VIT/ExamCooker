import assert from "node:assert/strict";
import { Capacitor } from "@capacitor/core";
import { PDFDocument } from "pdf-lib";
import {
  downloadPdfFile,
  preparePdfDownloadBlob,
} from "../lib/downloads/browser-downloads";
import type { PdfPageEdits } from "../lib/pdf/page-edits";

async function createSourcePdf() {
  const document = await PDFDocument.create();
  document.addPage([200, 300]);
  document.addPage([400, 300]);
  document.addPage([600, 300]);

  return document.save();
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
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
  const sourceBlob = new Blob([toArrayBuffer(sourceBytes)], {
    type: "application/pdf",
  });
  const globalAny = globalThis as any;

  assert.equal(
    await preparePdfDownloadBlob(sourceBlob, null),
    sourceBlob,
    "Unedited PDFs should keep the original download blob",
  );

  assert.equal(
    await preparePdfDownloadBlob(sourceBlob, { pageOrder: [], pageRotations: {} }),
    sourceBlob,
    "No-op edits should keep the original download blob",
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

  const originalFetch = globalThis.fetch;
  const originalWindow = globalAny.window;
  const originalDocument = globalAny.document;
  const nativePlatformDescriptor = Object.getOwnPropertyDescriptor(
    Capacitor,
    "isNativePlatform",
  );
  const nativePromiseDescriptor = Object.getOwnPropertyDescriptor(
    Capacitor,
    "nativePromise",
  );

  const clickedAnchors: Array<{
    href: string;
    download: string;
    target: string;
    rel: string;
  }> = [];
  const alerts: string[] = [];
  const createdObjectUrls: string[] = [];
  let objectUrlCount = 0;

  const createAnchor = () => {
    const anchor = {
      href: "",
      download: "",
      target: "",
      rel: "",
      click() {
        clickedAnchors.push({
          href: anchor.href,
          download: anchor.download,
          target: anchor.target,
          rel: anchor.rel,
        });
      },
      remove() {
        return;
      },
    };

    return anchor;
  };

  const windowMock = {
    URL: {
      createObjectURL() {
        objectUrlCount += 1;
        const next = `blob:mock-${objectUrlCount}`;
        createdObjectUrls.push(next);
        return next;
      },
      revokeObjectURL() {
        return;
      },
    },
    setTimeout(callback: () => void) {
      callback();
      return 1;
    },
    clearTimeout() {
      return;
    },
    alert(message: string) {
      alerts.push(message);
    },
    btoa(input: string) {
      return Buffer.from(input, "binary").toString("base64");
    },
  };
  const documentMock = {
    body: {
      appendChild() {
        return;
      },
    },
    createElement(tagName: string) {
      if (tagName !== "a") {
        throw new Error(`Unexpected element request: ${tagName}`);
      }
      return createAnchor();
    },
  };

  globalAny.window = windowMock;
  globalAny.document = documentMock;

  try {
    Object.defineProperty(Capacitor, "isNativePlatform", {
      configurable: true,
      value: () => false,
    });
    globalThis.fetch = async () => {
      throw new Error("network down");
    };

    await downloadPdfFile({
      fileUrl: "https://example.com/original.pdf",
      fileName: "fallback.pdf",
      pageEdits: { pageOrder: [], pageRotations: {} },
    });

    assert.equal(alerts.length, 0, "No-op edits should not show preparation alert");
    assert.deepEqual(clickedAnchors.pop(), {
      href: "https://example.com/original.pdf",
      download: "",
      target: "_blank",
      rel: "noopener noreferrer",
    });

    Object.defineProperty(Capacitor, "isNativePlatform", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(Capacitor, "nativePromise", {
      configurable: true,
      value: async () => {
        throw new Error("native save failed");
      },
    });
    globalThis.fetch = async () =>
      new Response(sourceBlob, {
        status: 200,
      });

    await downloadPdfFile({
      fileUrl: "https://example.com/edited.pdf",
      fileName: "edited.pdf",
      pageEdits,
    });

    assert.equal(alerts.length, 0, "Native save failures should not surface as prep alerts");
    assert.equal(createdObjectUrls.length, 1, "Native save failure should fall back to blob URL");
    assert.deepEqual(clickedAnchors.pop(), {
      href: "blob:mock-1",
      download: "edited.pdf",
      target: "",
      rel: "",
    });
  } finally {
    globalThis.fetch = originalFetch;

    if (typeof originalWindow === "undefined") {
      delete globalAny.window;
    } else {
      globalAny.window = originalWindow;
    }

    if (typeof originalDocument === "undefined") {
      delete globalAny.document;
    } else {
      globalAny.document = originalDocument;
    }

    if (nativePlatformDescriptor) {
      Object.defineProperty(Capacitor, "isNativePlatform", nativePlatformDescriptor);
    }

    if (nativePromiseDescriptor) {
      Object.defineProperty(Capacitor, "nativePromise", nativePromiseDescriptor);
    }
  }

  console.log("PDF download page edits are preserved.");
}

void main();
