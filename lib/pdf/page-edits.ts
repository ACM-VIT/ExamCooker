export const PDF_PAGE_ROTATIONS = [0, 90, 180, 270] as const;

export type PdfPageRotation = (typeof PDF_PAGE_ROTATIONS)[number];

export type PdfPageEdits = {
  pageOrder?: number[] | null;
  pageRotations?: Record<string, PdfPageRotation> | null;
};

export type PdfPageDisplayEntry = {
  displayIndex: number;
  originalIndex: number;
  rotation: PdfPageRotation;
};

export type PdfPageRenderEntry = {
  pageIndex: number;
  rotation: PdfPageRotation;
};

const PDF_PAGE_ROTATION_SET = new Set<number>(PDF_PAGE_ROTATIONS);

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function toPdfPageRotation(value: number): PdfPageRotation {
  const normalizedRotation = ((value % 360) + 360) % 360;

  switch (normalizedRotation) {
    case 90:
    case 180:
    case 270:
      return normalizedRotation;
    case 0:
      return 0;
    default:
      return 0;
  }
}

function toArrayBuffer(buffer: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (buffer instanceof Uint8Array) {
    const bytes = new Uint8Array(buffer.byteLength);
    bytes.set(buffer);
    return bytes.buffer;
  }

  return buffer;
}

function getIdentityPageOrder(totalPages: number) {
  return Array.from({ length: totalPages }, (_, index) => index);
}

function sanitizePageOrder(
  pageOrder: number[] | null | undefined,
  totalPages?: number,
) {
  if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
    return null;
  }

  const seen = new Set<number>();
  const sanitized: number[] = [];

  for (const pageIndex of pageOrder) {
    if (!isInteger(pageIndex) || seen.has(pageIndex) || pageIndex < 0) {
      continue;
    }

    if (typeof totalPages === "number" && pageIndex >= totalPages) {
      continue;
    }

    seen.add(pageIndex);
    sanitized.push(pageIndex);
  }

  if (typeof totalPages === "number") {
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      if (!seen.has(pageIndex)) {
        sanitized.push(pageIndex);
      }
    }

    const identity = getIdentityPageOrder(totalPages);
    const isIdentity = sanitized.every(
      (pageIndex, index) => pageIndex === identity[index],
    );
    return isIdentity ? null : sanitized;
  }

  return sanitized.length > 0 ? sanitized : null;
}

function sanitizePageRotations(
  pageRotations: Record<string, number> | null | undefined,
  totalPages?: number,
) {
  if (!pageRotations || typeof pageRotations !== "object") {
    return null;
  }

  const sanitized: Record<string, PdfPageRotation> = {};

  for (const [key, value] of Object.entries(pageRotations)) {
    const pageIndex = Number.parseInt(key, 10);
    if (!Number.isInteger(pageIndex) || pageIndex < 0) {
      continue;
    }

    if (typeof totalPages === "number" && pageIndex >= totalPages) {
      continue;
    }

    if (!isInteger(value) || !PDF_PAGE_ROTATION_SET.has(value)) {
      continue;
    }

    if (value !== 0) {
      sanitized[String(pageIndex)] = value as PdfPageRotation;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function hasPdfPageEdits(edits: PdfPageEdits | null | undefined) {
  return Boolean(
    edits?.pageOrder?.length || Object.keys(edits?.pageRotations ?? {}).length,
  );
}

export function normalizePdfPageEdits(
  edits: PdfPageEdits | null | undefined,
  totalPages?: number,
): PdfPageEdits | null {
  if (!edits) {
    return null;
  }

  const pageOrder = sanitizePageOrder(edits.pageOrder ?? null, totalPages);
  const pageRotations = sanitizePageRotations(
    edits.pageRotations ?? null,
    totalPages,
  );

  if (!pageOrder && !pageRotations) {
    return null;
  }

  return {
    pageOrder,
    pageRotations,
  };
}

export function serializePdfPageEdits(
  edits: PdfPageEdits | null | undefined,
  totalPages?: number,
) {
  return JSON.stringify(normalizePdfPageEdits(edits, totalPages) ?? null);
}

export function arePdfPageEditsEqual(
  left: PdfPageEdits | null | undefined,
  right: PdfPageEdits | null | undefined,
  totalPages?: number,
) {
  return serializePdfPageEdits(left, totalPages) === serializePdfPageEdits(right, totalPages);
}

export function getPdfPageDisplayEntries(
  totalPages: number,
  edits: PdfPageEdits | null | undefined,
): PdfPageDisplayEntry[] {
  const normalized = normalizePdfPageEdits(edits, totalPages);
  const pageOrder = normalized?.pageOrder ?? getIdentityPageOrder(totalPages);
  const pageRotations = normalized?.pageRotations ?? null;

  return pageOrder.map((originalIndex, displayIndex) => ({
    displayIndex,
    originalIndex,
    rotation: pageRotations?.[String(originalIndex)] ?? 0,
  }));
}

export function getPdfPageRenderEntry(input: {
  baselineEdits: PdfPageEdits | null | undefined;
  entry: PdfPageDisplayEntry;
  totalPages: number;
}): PdfPageRenderEntry {
  const baselineEntry = getPdfPageDisplayEntries(
    input.totalPages,
    input.baselineEdits,
  ).find((entry) => entry.originalIndex === input.entry.originalIndex);
  const baselineRotation = baselineEntry?.rotation ?? 0;

  return {
    pageIndex: baselineEntry?.displayIndex ?? input.entry.originalIndex,
    rotation: toPdfPageRotation(input.entry.rotation - baselineRotation),
  };
}

export function applyPdfPageEditsLocally(
  edits: PdfPageEdits | null | undefined,
  recipe: (draft: PdfPageEdits) => PdfPageEdits | null,
  totalPages?: number,
) {
  const current =
    normalizePdfPageEdits(edits, totalPages) ?? {
      pageOrder: null,
      pageRotations: null,
    };

  return normalizePdfPageEdits(recipe(current), totalPages);
}

export async function applyPdfPageEditsToBuffer(
  buffer: ArrayBuffer | Uint8Array,
  edits: PdfPageEdits | null | undefined,
) {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const sourceBytes = new Uint8Array(toArrayBuffer(buffer));
  const sourceDocument = await PDFDocument.load(sourceBytes);
  const totalPages = sourceDocument.getPageCount();
  const normalized = normalizePdfPageEdits(edits, totalPages);

  if (!normalized) {
    return toArrayBuffer(sourceBytes);
  }

  const nextDocument = await PDFDocument.create();
  const pageOrder = normalized.pageOrder ?? getIdentityPageOrder(totalPages);
  const pageRotations = normalized.pageRotations ?? null;
  const copiedPages = await nextDocument.copyPages(sourceDocument, pageOrder);

  copiedPages.forEach((page, displayIndex) => {
    const originalIndex = pageOrder[displayIndex];
    if (typeof originalIndex !== "number") {
      return;
    }

    const rotationDelta = pageRotations?.[String(originalIndex)] ?? 0;
    if (rotationDelta !== 0) {
      const currentRotation = page.getRotation().angle;
      const nextRotation = ((currentRotation + rotationDelta) % 360 + 360) % 360;
      page.setRotation(degrees(nextRotation));
    }

    nextDocument.addPage(page);
  });

  const nextBytes = await nextDocument.save();
  return toArrayBuffer(nextBytes);
}
