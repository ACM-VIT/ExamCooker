// Limit a single canvas to ~24 MB of pixels before PDFium/encoding copies.
// Large scanned pages and high zoom otherwise exhaust mobile canvas memory.
export function pdfRenderDpr(width: number, height: number, scale: number, deviceDpr: number, retry = false) {
  const scaledWidth = Math.max(1, width * scale);
  const scaledHeight = Math.max(1, height * scale);
  const preferred = Math.max(1, Math.min(deviceDpr || 1, 2));
  const dpr = Math.min(preferred, Math.sqrt(6_000_000 / (scaledWidth * scaledHeight)), 8192 / Math.max(scaledWidth, scaledHeight));
  return dpr * (retry ? 0.65 : 1);
}
