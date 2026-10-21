function backendMismatchResponse(request: Request) {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
  });
  // Next treats a failed RSC read as an unavailable prefetch or a hard
  // navigation to the requested destination. Never reload the current page
  // for a GET: visible links can prefetch Azure-only routes on every load.
  if (request.method !== "GET" && request.method !== "HEAD") headers.set("x-ec-reload", "1");
  return new Response(null, { status: 409, headers });
}

function isDocument(request: Request) {
  return request.method === "GET" && !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    !/prefetch|prerender/i.test(`${request.headers.get("purpose") || ""} ${request.headers.get("sec-purpose") || ""}`) &&
    !new URL(request.url).searchParams.has("_rsc") &&
    (request.headers.get("sec-fetch-dest") === "document" || (request.headers.get("accept") || "").includes("text/html"));
}

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
