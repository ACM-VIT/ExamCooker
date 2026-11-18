// Browser-only: decodes photos, downscales them and builds a paper's PDF.
// The size math and encoding ladder are in `page-images.ts`.

import {
  DEFAULT_PAGE_ENCODING,
  MAX_UPLOAD_PDF_BYTES,
  PAGE_ENCODING_STEPS,
  estimatePdfBytes,
  fitWithinEdge,
  fitsUploadLimit,
  pickEncodingStep,
  rotatedSize,
  type PageEncoding,
  type PageRotation,
} from "@/lib/uploads/page-images";

export type EncodedPageImage = {
  blob: Blob;
  width: number;
  height: number;
};

export class UnreadablePhotoError extends Error {
  constructor() {
    super("The photo could not be decoded.");
    this.name = "UnreadablePhotoError";
  }
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Some browsers reject the options or the format here but can still
      // decode the photo through an image element.
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new UnreadablePhotoError();
  }
  if (!image.naturalWidth || !image.naturalHeight) {
    URL.revokeObjectURL(url);
    throw new UnreadablePhotoError();
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    },
  };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Image encoding failed."))),
      "image/jpeg",
      quality,
    );
  });
}

async function drawToJpeg(
  decoded: DecodedImage,
  encoding: PageEncoding,
  rotation: PageRotation,
): Promise<EncodedPageImage> {
  const canvas = document.createElement("canvas");
  try {
    const scaled = fitWithinEdge(decoded.width, decoded.height, encoding.maxEdge);
    const output = rotatedSize(scaled.width, scaled.height, rotation);
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");

    // Transparent screenshots would otherwise turn black as JPEG.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.translate(output.width / 2, output.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(decoded.source, -scaled.width / 2, -scaled.height / 2, scaled.width, scaled.height);

    const blob = await canvasToJpeg(canvas, encoding.quality);
    return { blob, width: output.width, height: output.height };
  } finally {
    // Free the backing store now; iOS limits the total canvas memory.
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Decodes a photo, scales it so the long edge is at most `encoding.maxEdge`,
 * turns it by `rotation` and encodes it as JPEG. Rotation is drawn into the
 * pixels rather than stored as PDF page rotation, which not every renderer
 * honours.
 */
export async function encodePageImage(
  file: Blob,
  encoding: PageEncoding = DEFAULT_PAGE_ENCODING,
  rotation: PageRotation = 0,
): Promise<EncodedPageImage> {
  const decoded = await decodeImage(file);
  try {
    return await drawToJpeg(decoded, encoding, rotation);
  } finally {
    decoded.release();
  }
}

const THUMBNAIL_ENCODING: PageEncoding = { maxEdge: 360, quality: 0.7 };

/**
 * Processes a newly added photo once: the page image used for the PDF and a
 * small thumbnail for the page grid, from a single decode.
 */
export async function processPhotoPage(file: Blob) {
  const decoded = await decodeImage(file);
  try {
    const image = await drawToJpeg(decoded, DEFAULT_PAGE_ENCODING, 0);
    const thumbnail = await drawToJpeg(decoded, THUMBNAIL_ENCODING, 0);
    return { ...image, thumbnail: thumbnail.blob };
  } finally {
    decoded.release();
  }
}

export type PhotoPdfPage = {
  source: Blob;
  image: EncodedPageImage;
  rotation: PageRotation;
};

export type PhotoPdfResult =
  | { ok: true; file: File }
  | { ok: false; bytes: number };

async function writePdf(images: EncodedPageImage[]) {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  for (const image of images) {
    const embedded = await pdf.embedJpg(await image.blob.arrayBuffer());
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return pdf.save();
}

/**
 * Builds one PDF from a paper's pages, one page per photo. When the PDF would
 * be over the upload limit, the pages are encoded again from the original
 * photos with smaller settings. Resolves to `ok: false` with the smallest
 * size reached when no setting fits.
 */
export async function buildPhotoPdf(
  pages: readonly PhotoPdfPage[],
  fileName: string,
  limit = MAX_UPLOAD_PDF_BYTES,
): Promise<PhotoPdfResult> {
  const lastStep = PAGE_ENCODING_STEPS.length - 1;
  const predicted = pickEncodingStep(estimatePdfBytes(pages.map((page) => page.image.blob.size)), limit);
  let smallest = Number.POSITIVE_INFINITY;

  for (let step = predicted === -1 ? lastStep : predicted; step <= lastStep; step += 1) {
    const images: EncodedPageImage[] = [];
    for (const page of pages) {
      images.push(
        step === 0 && page.rotation === 0
          ? page.image
          : await encodePageImage(page.source, PAGE_ENCODING_STEPS[step], page.rotation),
      );
    }
    // Skip writing a PDF that is already known to be too large.
    const estimate = estimatePdfBytes(images.map((image) => image.blob.size));
    if (!fitsUploadLimit(estimate, limit) && step < lastStep) {
      smallest = Math.min(smallest, estimate);
      continue;
    }
    const bytes = await writePdf(images);
    smallest = Math.min(smallest, bytes.byteLength);
    if (fitsUploadLimit(bytes.byteLength, limit)) {
      return {
        ok: true,
        file: new File([bytes.buffer as ArrayBuffer], fileName, {
          type: "application/pdf",
          lastModified: Date.now(),
        }),
      };
    }
  }

  return { ok: false, bytes: smallest };
}
