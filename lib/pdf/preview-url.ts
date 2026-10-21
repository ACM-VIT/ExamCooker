import { getAssetDeliveryUrl } from "@/lib/storage/public-assets";
import { normalizePdfPageEdits, type PdfPageEdits } from "./page-edits";

const PAPER_PDF = /^\/(past-papers\/[a-zA-Z0-9-]{20,64})\/paper\.pdf$/;
const MAX_PREVIEW_PAGE = 63;

/**
 * The asset host's rendered image of the page the viewer shows first, after
 * moderator reordering and rotation. Null where no preview can exist.
 */
export function getPdfFirstPagePreviewUrl(
  fileUrl: string,
  pageEdits?: PdfPageEdits | null,
  baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL,
): string | null {
  const deliveryUrl = getAssetDeliveryUrl(fileUrl, baseUrl);
  if (deliveryUrl === fileUrl) return null;
  const url = new URL(deliveryUrl);
  const match = PAPER_PDF.exec(url.pathname);
  if (!match) return null;
  const edits = normalizePdfPageEdits(pageEdits);
  const page = edits?.pageOrder?.[0] ?? 0;
  if (page > MAX_PREVIEW_PAGE) return null;
  const rotation = edits?.pageRotations?.[String(page)] ?? 0;
  return `${url.origin}/_preview/v1/${match[1]}/p${page}-r${rotation}.webp`;
}
