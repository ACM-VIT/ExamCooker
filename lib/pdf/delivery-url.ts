import { getAssetDeliveryUrl } from "@/lib/storage/public-assets";

const PAPER_ORIGIN = "https://examcookerprodsi.blob.core.windows.net";
const SYLLABUS_ORIGIN = "https://ec-syllabus.acmvit.in";

// Only public PDFs from these two fixed locations have an app delivery route.
// Never forward signed URLs, arbitrary hosts, or arbitrary storage paths.
export function publicPdfUpstream(source: string, file: string): string | null {
  if (source === "paper" && /^[a-zA-Z0-9-]{20,64}$/.test(file)) {
    return `${PAPER_ORIGIN}/exam-assets/past-papers/${file}/paper.pdf`;
  }
  if (source === "syllabus" && file.length <= 240 &&
      /^[a-zA-Z0-9]+_[a-zA-Z0-9_.-]+\.pdf$/i.test(file) && !file.includes("..")) {
    return `${SYLLABUS_ORIGIN}/files/syllabi/${file}`;
  }
  return null;
}

export function getPdfFallbackUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    if (url.username || url.password || url.search || url.hash) return null;
    const match = url.origin === PAPER_ORIGIN
      ? url.pathname.match(/^\/exam-assets\/past-papers\/([^/]+)\/paper\.pdf$/)
      : url.origin === SYLLABUS_ORIGIN
        ? url.pathname.match(/^\/files\/syllabi\/([^/]+)$/)
        : null;
    if (!match) return null;
    const source = url.origin === PAPER_ORIGIN ? "paper" : "syllabus";
    return publicPdfUpstream(source, match[1]) === fileUrl
      ? `/api/pdf/${source}/${match[1]}`
      : null;
  } catch {
    return null;
  }
}

export function getPdfDeliveryUrl(fileUrl: string): string {
  const assetUrl = getAssetDeliveryUrl(fileUrl);
  if (assetUrl !== fileUrl) return assetUrl;
  const fallback = getPdfFallbackUrl(fileUrl);
  // The syllabus service rejects browser CORS requests from the app. Papers
  // keep their direct storage path unless that download actually fails.
  return fallback?.startsWith("/api/pdf/syllabus/") ? fallback : fileUrl;
}
