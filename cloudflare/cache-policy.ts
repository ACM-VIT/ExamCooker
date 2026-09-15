/** The Next data cache may share public data; the HTTP cache must not share identity. */
export function protectPersonalizedResponse(request: Request, response: Response) {
  const path = new URL(request.url).pathname;
  const contentType = response.headers.get("content-type") ?? "";
  const dynamicResponse = contentType.includes("text/html") || contentType.includes("text/x-component");
  const sensitive = request.method !== "GET" && request.method !== "HEAD" ||
    request.headers.has("cookie") || request.headers.has("authorization") ||
    request.headers.has("rsc") || request.headers.has("next-action") ||
    response.headers.has("set-cookie") || path.startsWith("/api/") ||
    path === "/auth" || path.startsWith("/auth/") ||
    path.startsWith("/native-auth/") || path === "/mod" || path.startsWith("/mod/") ||
    dynamicResponse;
  if (!sensitive) return response;

  const protectedResponse = new Response(response.body, response);
  protectedResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  protectedResponse.headers.set("CDN-Cache-Control", "no-store");
  protectedResponse.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  return protectedResponse;
}
