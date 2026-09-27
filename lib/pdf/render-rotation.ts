import type { Rotation } from "@embedpdf/models";

// DocumentManager opens normalized pages: PDFium removes the page's intrinsic
// rotation from the bitmap. Add it back, just as ScrollPlugin does for layout.
export function getEffectivePdfRotation(
  pageRotation: Rotation | undefined,
  additionalRotation: Rotation,
): Rotation {
  return (((pageRotation ?? 0) + additionalRotation) % 4) as Rotation;
}
