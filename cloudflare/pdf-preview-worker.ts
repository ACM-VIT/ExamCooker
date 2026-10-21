// Renders one PDF page to WebP for the assets Worker. It has no public route:
// examcooker-assets calls it through a service binding and stores the result.
import pdfiumWasm from "@embedpdf/pdfium/pdfium.wasm";
// The browser build runs in workerd once given a precompiled module.
import { init } from "@embedpdf/pdfium";
import { getPreviewDocument } from "../lib/pdf/preview-source";

type Env = { BUCKET: R2Bucket; IMAGES: ImagesBinding };

const MAX_PDF_BYTES = 24 * 1024 * 1024;
const PREVIEW_WIDTH = 1200;
const MAX_PREVIEW_HEIGHT = 2400;
// Match the viewer, which renders without annotations or forms. Reverse byte
// order makes PDFium write RGBA instead of BGRA.
const RENDER_FLAGS = 0x10;

export class Unrenderable extends Error {}

// A fresh instance per render: a large document cannot leave the WASM heap
// grown for later requests. The module itself is compiled once at upload.
async function createPdfium() {
  const pdfium = await init({
    instantiateWasm(imports: WebAssembly.Imports, receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void) {
      void WebAssembly.instantiate(pdfiumWasm, imports).then((instance) => receive(instance, pdfiumWasm));
      return {};
    },
  } as Parameters<typeof init>[0]);
  pdfium.PDFiumExt_Init();
  return pdfium;
}

function renderPage(pdfium: Awaited<ReturnType<typeof createPdfium>>, bytes: Uint8Array, pageIndex: number, quarterTurns: number) {
  // HEAPU8 is replaced when memory grows; read it after each PDFium call.
  const runtime = pdfium.pdfium as typeof pdfium.pdfium & { HEAPU8: Uint8Array };
  const filePtr = runtime.wasmExports.malloc(bytes.length);
  runtime.HEAPU8.set(bytes, filePtr);
  const doc = pdfium.FPDF_LoadMemDocument(filePtr, bytes.length, "");
  try {
    if (!doc) throw new Unrenderable("PDF could not be opened");
    if (pageIndex >= pdfium.FPDF_GetPageCount(doc)) throw new Unrenderable("Page out of range");
    const page = pdfium.FPDF_LoadPage(doc, pageIndex);
    if (!page) throw new Unrenderable("Page could not be loaded");
    try {
      const sideways = quarterTurns % 2 === 1;
      const pageWidth = sideways ? pdfium.FPDF_GetPageHeightF(page) : pdfium.FPDF_GetPageWidthF(page);
      const pageHeight = sideways ? pdfium.FPDF_GetPageWidthF(page) : pdfium.FPDF_GetPageHeightF(page);
      if (!(pageWidth > 0 && pageHeight > 0)) throw new Unrenderable("Page has no area");
      const scale = Math.min(PREVIEW_WIDTH / pageWidth, MAX_PREVIEW_HEIGHT / pageHeight);
      const width = Math.max(1, Math.round(pageWidth * scale));
      const height = Math.max(1, Math.round(pageHeight * scale));
      const bitmap = pdfium.FPDFBitmap_Create(width, height, 0);
      try {
        pdfium.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xffffffff);
        pdfium.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, quarterTurns, RENDER_FLAGS);
        const buffer = pdfium.FPDFBitmap_GetBuffer(bitmap);
        const stride = pdfium.FPDFBitmap_GetStride(bitmap);
        const rgb = new Uint8Array(width * height * 3);
        for (let y = 0; y < height; y++) {
          const row = runtime.HEAPU8.subarray(buffer + y * stride, buffer + y * stride + width * 4);
          for (let x = 0, out = y * width * 3; x < width; x++, out += 3) {
            rgb[out] = row[x * 4];
            rgb[out + 1] = row[x * 4 + 1];
            rgb[out + 2] = row[x * 4 + 2];
          }
        }
        return { rgb, width, height };
      } finally {
        pdfium.FPDFBitmap_Destroy(bitmap);
      }
    } finally {
      pdfium.FPDF_ClosePage(page);
    }
  } finally {
    if (doc) pdfium.FPDF_CloseDocument(doc);
    runtime.wasmExports.free(filePtr);
  }
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function pngChunk(type: string, data: Uint8Array) {
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 8 + data.length)) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  view.setUint32(8 + data.length, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}

/** Lossless RGB PNG; the Images binding re-encodes it as WebP. */
async function encodePng({ rgb, width, height }: { rgb: Uint8Array; width: number; height: number }) {
  const rows = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) rows.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (width * 3 + 1) + 1);
  const pixels = await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer();
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolor RGB
  return new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(pixels)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

/** Render one page (plus any extra clockwise quarter turns) to a lossless PNG. */
export async function renderPreviewPng(bytes: Uint8Array, pageIndex: number, quarterTurns: number) {
  const page = renderPage(await createPdfium(), bytes, pageIndex, quarterTurns);
  return { png: await encodePng(page), width: page.width, height: page.height };
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key") ?? "";
    const pageIndex = Number(url.searchParams.get("page"));
    const rotation = Number(url.searchParams.get("rotation"));
    if (url.pathname !== "/render" || !getPreviewDocument(key) || !Number.isInteger(pageIndex) ||
        pageIndex < 0 || pageIndex > 63 || ![0, 90, 180, 270].includes(rotation)) {
      return new Response("Invalid preview request", { status: 400 });
    }
    const source = await env.BUCKET.get(key);
    if (!source || source.customMetadata?.azureDeleted === "true") return new Response(null, { status: 404 });
    if (source.size > MAX_PDF_BYTES) {
      await source.body.cancel();
      return new Response("PDF too large to preview", { status: 422, headers: { "x-ec-source-etag": source.etag } });
    }
    const bytes = new Uint8Array(await source.arrayBuffer());
    try {
      const page = await renderPreviewPng(bytes, pageIndex, rotation / 90);
      const output = await env.IMAGES.input(page.png.stream()).output({ format: "image/webp", quality: 72 });
      return output.response({
        headers: { "x-ec-source-etag": source.etag, "x-ec-preview-size": `${page.width}x${page.height}` },
      });
    } catch (error) {
      if (error instanceof Unrenderable) {
        return new Response(error.message, { status: 422, headers: { "x-ec-source-etag": source.etag } });
      }
      console.error("[pdf-preview]", key, pageIndex, error instanceof Error ? error.message : "Render failed");
      return new Response("Render failed", { status: 500 });
    }
  },
};
