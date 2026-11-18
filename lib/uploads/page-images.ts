// Pure helpers for photographed paper pages: sizing, page order and rotation,
// and keeping the PDF built from the photos under the upload limit. The
// browser-only decoding and encoding lives in `page-image-encoding.ts`.

export const MAX_UPLOAD_PDF_BYTES = 25 * 1024 * 1024;
// pdf-lib adds a small object table per page and a trailer; this margin keeps
// the estimate on the safe side of the server limit.
const PDF_BASE_OVERHEAD_BYTES = 16 * 1024;
const PDF_PAGE_OVERHEAD_BYTES = 1024;
const PDF_SIZE_SAFETY_RATIO = 0.97;

export type PageRotation = 0 | 90 | 180 | 270;

export type PageEncoding = {
  maxEdge: number;
  quality: number;
};

/**
 * The encoding used when a photo is added, followed by smaller encodings that
 * are tried in order when a paper's PDF would be too large. `sizeRatio` is a
 * rough expected size relative to the first step, used to skip steps that
 * cannot fit.
 */
export const PAGE_ENCODING_STEPS: ReadonlyArray<PageEncoding & { sizeRatio: number }> = [
  { maxEdge: 2000, quality: 0.8, sizeRatio: 1 },
  { maxEdge: 2000, quality: 0.65, sizeRatio: 0.72 },
  { maxEdge: 1600, quality: 0.6, sizeRatio: 0.45 },
  { maxEdge: 1280, quality: 0.55, sizeRatio: 0.3 },
];

export const DEFAULT_PAGE_ENCODING: PageEncoding = PAGE_ENCODING_STEPS[0];

/** Scales a size down so its longer edge is at most `maxEdge`; never scales up. */
export function fitWithinEdge(width: number, height: number, maxEdge: number) {
  if (!(width > 0) || !(height > 0)) {
    throw new RangeError("Image dimensions must be positive.");
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function rotateClockwise(rotation: PageRotation): PageRotation {
  return ((rotation + 90) % 360) as PageRotation;
}

/** The size of an image once it is turned by `rotation`. */
export function rotatedSize(width: number, height: number, rotation: PageRotation) {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

/** Moves the item with `id` by `delta` places, clamped to the list. */
export function moveById<T extends { id: string }>(items: readonly T[], id: string, delta: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from === -1) return [...items];
  const to = Math.min(items.length - 1, Math.max(0, from + delta));
  if (to === from) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeById<T extends { id: string }>(items: readonly T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}

export function updateById<T extends { id: string }>(
  items: readonly T[],
  id: string,
  update: (item: T) => T,
): T[] {
  return items.map((item) => (item.id === id ? update(item) : item));
}

export function estimatePdfBytes(pageBytes: readonly number[]) {
  return pageBytes.reduce(
    (total, bytes) => total + bytes + PDF_PAGE_OVERHEAD_BYTES,
    PDF_BASE_OVERHEAD_BYTES,
  );
}

export function fitsUploadLimit(bytes: number, limit = MAX_UPLOAD_PDF_BYTES) {
  return bytes <= limit * PDF_SIZE_SAFETY_RATIO;
}

/**
 * Picks the first encoding step expected to fit, given the estimated PDF size
 * at step 0. Returns -1 when even the smallest step is not expected to fit.
 * Starting from a later step only saves work; the built PDF is still checked.
 */
export function pickEncodingStep(estimatedBytesAtFirstStep: number, limit = MAX_UPLOAD_PDF_BYTES) {
  return PAGE_ENCODING_STEPS.findIndex((step) =>
    fitsUploadLimit(estimatedBytesAtFirstStep * step.sizeRatio, limit),
  );
}

export function formatMegabytes(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes < 10 ? megabytes.toFixed(1) : Math.round(megabytes)} MB`;
}

const HEIC_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function isHeicLike(file: { name: string; type: string }) {
  return HEIC_TYPES.has(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

export const HEIC_UNSUPPORTED_MESSAGE =
  "This browser can't read HEIC photos. Export them as JPEG, or take them with the camera.";

export function unreadablePhotoMessage(file: { name: string; type: string }) {
  return isHeicLike(file)
    ? HEIC_UNSUPPORTED_MESSAGE
    : `Couldn't read ${file.name || "this photo"}. Try a JPEG or PNG.`;
}
