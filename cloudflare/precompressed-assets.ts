// Content-addressed PDF engine builds. Wrangler routes only these requests to
// the Worker before static assets (`assets.run_worker_first`).
const PDF_ENGINE = /^\/vendor\/embedpdf\/immutable\/[a-f0-9]{64}\.wasm$/;

function acceptsBrotli(request: Request) {
  // Cloudflare may normalize Accept-Encoding before the Worker; the original
  // client value decides whether pre-encoded bytes are safe to send.
  const cf = (request as Request & { cf?: { clientAcceptEncoding?: string } }).cf;
  const accepted = cf?.clientAcceptEncoding ?? request.headers.get("accept-encoding") ?? "";
  return accepted.split(",").some((encoding) => {
    const [name, ...params] = encoding.trim().toLowerCase().split(";");
    return name === "br" && !params.some((param) => /^\s*q\s*=\s*0(\.0+)?\s*$/.test(param));
  });
}

/** Serve the build's quality-11 brotli copy of the PDF engine instead of on-the-fly compression. */
export async function precompressedAssetResponse(request: Request, assets: Fetcher): Promise<Response | null> {
  const url = new URL(request.url);
  if (!PDF_ENGINE.test(url.pathname)) return null;
  if ((request.method !== "GET" && request.method !== "HEAD") || !acceptsBrotli(request)) return assets.fetch(request);
  const compressed = await assets.fetch(new Request(`${url.origin}${url.pathname}.br`, { method: request.method }));
  if (!compressed.ok) return assets.fetch(request);
  const headers = new Headers({
    "content-type": "application/wasm",
    "content-encoding": "br",
    "cache-control": "public, max-age=31536000, immutable",
    vary: "accept-encoding",
  });
  const length = compressed.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(compressed.body, { headers, encodeBody: "manual" });
}
