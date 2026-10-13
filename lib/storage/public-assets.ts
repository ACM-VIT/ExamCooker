const AZURE_ORIGIN = "https://examcookerprodsi.blob.core.windows.net";
const CONTAINER_PATH = "/exam-assets/";

// Keep database URLs portable between deployments. Only the Cloudflare build
// substitutes public asset delivery; signed URLs and other storage stay intact.
export function getAssetDeliveryUrl(
  value: string,
  baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL,
): string {
  if (!baseUrl) return value;
  try {
    const url = new URL(value);
    if (url.origin !== AZURE_ORIGIN || url.username || url.password ||
        url.search || url.hash || !url.pathname.startsWith(CONTAINER_PATH)) return value;
    const key = url.pathname.slice(CONTAINER_PATH.length);
    if (!key) return value;
    return `${baseUrl.replace(/\/$/, "")}/${key}`;
  } catch {
    return value;
  }
}
