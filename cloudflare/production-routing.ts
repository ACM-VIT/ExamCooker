import { backendMismatchResponse, isDocument } from "./cutover/policy";

/** Keep tabs opened before the Azure cutover from submitting stale Server Actions. */
export function productionCompatibilityResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname === "exam-cooker.acmvit.in") {
    url.hostname = "examcooker.acmvit.in";
    return Response.redirect(url.href, 308);
  }
  // Old pages may send their final rollout beacon after the experiment ends.
  if (url.pathname === "/__ec_cutover/event" && request.method === "POST") {
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  }
  if (!isDocument(request) && request.headers.get("x-ec-document-backend") === "azure") {
    return backendMismatchResponse(request);
  }
  return null;
}

export function isPreviousBuildAsset(request: Request) {
  return (request.method === "GET" || request.method === "HEAD") &&
    /^\/_next\/static\/(chunks|css|media)\/.+\.(js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif)$/.test(new URL(request.url).pathname);
}
