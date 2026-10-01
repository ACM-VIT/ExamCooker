import { publicPdfUpstream } from "./delivery-url";

const MAX_PDF_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const errorResponse = (status: number) => new Response("PDF unavailable", {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function servePublicPdf(source: string, file: string, signal?: AbortSignal) {
  const upstream = publicPdfUpstream(source, file);
  if (!upstream) return errorResponse(404);

  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cleanup = () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  };
  const cancel = () => { void reader?.cancel().catch(() => undefined); cleanup(); };

  try {
    signal?.throwIfAborted();
    // No cookies, authorization, Origin, or user-supplied headers are forwarded.
    const response = await fetch(upstream, {
      // workerd supports manual/follow, but rejects redirect: "error".
      // A 3xx is rejected by the status check below without following it.
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/pdf" },
    });
    if (!response.ok || !response.body) {
      void response.body?.cancel().catch(() => undefined);
      cleanup();
      return errorResponse(response.status === 404 ? 404 : 502);
    }
    // Fetch can transparently decompress an upstream response; its compressed
    // Content-Length then no longer describes the bytes we send to the client.
    const encoding = response.headers.get("content-encoding");
    const length = encoding && encoding !== "identity"
      ? 0
      : Number(response.headers.get("content-length"));
    if (length > MAX_PDF_BYTES) {
      void response.body.cancel().catch(() => undefined);
      cleanup();
      return errorResponse(502);
    }

    reader = response.body.getReader();
    // Validate before sending a cacheable 200, then stream without buffering the
    // whole document in Worker memory. A storage error page must never be cached.
    const prefix: Uint8Array[] = [];
    let received = 0;
    while (received < 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      prefix.push(value);
      received += value.byteLength;
      if (received > MAX_PDF_BYTES) throw new Error("PDF exceeds size limit");
    }
    const header = new Uint8Array(Math.min(received, 1024));
    let offset = 0;
    for (const chunk of prefix) {
      const bytes = chunk.subarray(0, header.length - offset);
      header.set(bytes, offset);
      offset += bytes.byteLength;
      if (offset === header.length) break;
    }
    if (!new TextDecoder("latin1").decode(header).includes("%PDF-")) {
      cancel();
      return errorResponse(502);
    }

    const body = new ReadableStream<Uint8Array>({
      async pull(output) {
        try {
          if (prefix.length) { output.enqueue(prefix.shift()!); return; }
          const { done, value } = await reader!.read();
          if (done) {
            if (length > 0 && received !== length) throw new Error("Incomplete PDF");
            cleanup();
            output.close();
            return;
          }
          received += value.byteLength;
          if (received > MAX_PDF_BYTES) throw new Error("PDF exceeds size limit");
          output.enqueue(value);
        } catch (error) {
          cancel();
          output.error(error);
        }
      },
      cancel() { controller.abort(); cancel(); },
    });
    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    if (Number.isSafeInteger(length) && length > 0) headers.set("Content-Length", String(length));
    return new Response(body, { headers });
  } catch (error) {
    console.warn("[pdf-delivery] Public PDF request failed", {
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    controller.abort();
    cancel();
    return errorResponse(502);
  }
}
