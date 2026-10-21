// Which stored PDFs can have first-page previews. Shared by the app, which
// builds preview URLs, and the asset and renderer Workers, which serve them.
//
// Uploads use past-papers/<id>/paper.pdf. Papers uploaded before that scheme
// keep a root <uuid>.pdf key. A preview path names the document without its
// file name, and each form maps back to exactly one PDF key.
const MODERN = "past-papers\\/[a-zA-Z0-9-]{20,64}";
const LEGACY = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Regex source for the document part of a preview path. */
export const PREVIEW_DOCUMENT = `(?:${MODERN}|${LEGACY})`;

const SOURCE_KEY = new RegExp(`^(?:(${MODERN})\\/paper|(${LEGACY}))\\.pdf$`);

/** The preview document for a stored PDF key, or null when it has no preview. */
export function getPreviewDocument(key: string): string | null {
  const match = SOURCE_KEY.exec(key);
  return match ? match[1] ?? match[2] : null;
}

/** The stored PDF key a preview document was rendered from. */
export function getPreviewSourceKey(document: string): string {
  return document.startsWith("past-papers/") ? `${document}/paper.pdf` : `${document}.pdf`;
}
