import { appendFileSync } from "node:fs";
import { publicPdfUpstream } from "./delivery-url";

const MAX_PDF_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const errorResponse = (status: number) => new Response("PDF unavailable", {
  status,
  headers: { "Cache-Control": "no-store" },
});

// #region agent log
function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  try {
    appendFileSync("/opt/cursor/logs/debug.log",
      `${JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now() })}\n`);
  } catch {}
}
// #endregion

export async function servePublicPdf(
  source: string,
  file: string,
  signal?: AbortSignal,
  debugRequest?: { cacheControl: string | null },
) {
  const upstream = publicPdfUpstream(source, file);
  if (!upstream) return errorResponse(404);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let lastChunkAt = startedAt;
  let lastProgressLoggedAt = startedAt;
  let received = 0;
  let length = 0;
  let pullCount = 0;
  let timeoutFired = false;
  // #region agent log
  agentLog("A,C,D", "lib/pdf/public-delivery.ts:43", "Public PDF request started", {
    requestId, source, cacheControl: debugRequest?.cacheControl ?? null,
    externalAborted: signal?.aborted ?? false,
  });
  // #endregion
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timeoutFired = true;
    // #region agent log
    agentLog("A,B,E", "lib/pdf/public-delivery.ts:54", "Absolute public PDF timeout fired", {
      requestId, elapsedMs: Date.now() - startedAt, received, length, pullCount,
      msSinceLastChunk: Date.now() - lastChunkAt,
      externalAborted: signal?.aborted ?? false,
    });
    // #endregion
    controller.abort();
  }, TIMEOUT_MS);
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
    // #region agent log
    agentLog("A,E", "lib/pdf/public-delivery.ts:80", "Upstream PDF response received", {
      requestId, elapsedMs: Date.now() - startedAt, status: response.status,
      contentLength: response.headers.get("content-length"),
      contentEncoding: response.headers.get("content-encoding"),
    });
    // #endregion
    if (!response.ok || !response.body) {
      void response.body?.cancel().catch(() => undefined);
      cleanup();
      return errorResponse(response.status === 404 ? 404 : 502);
    }
    // Fetch can transparently decompress an upstream response; its compressed
    // Content-Length then no longer describes the bytes we send to the client.
    const encoding = response.headers.get("content-encoding");
    length = encoding && encoding !== "identity"
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
    while (received < 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      prefix.push(value);
      received += value.byteLength;
      lastChunkAt = Date.now();
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
        pullCount++;
        try {
          if (prefix.length) { output.enqueue(prefix.shift()!); return; }
          const { done, value } = await reader!.read();
          if (done) {
            if (length > 0 && received !== length) throw new Error("Incomplete PDF");
            // #region agent log
            agentLog("A,B,E", "lib/pdf/public-delivery.ts:137", "Public PDF stream completed", {
              requestId, elapsedMs: Date.now() - startedAt, received, length, pullCount,
            });
            // #endregion
            cleanup();
            output.close();
            return;
          }
          received += value.byteLength;
          lastChunkAt = Date.now();
          if (received > MAX_PDF_BYTES) throw new Error("PDF exceeds size limit");
          if (lastChunkAt - lastProgressLoggedAt >= 5_000) {
            lastProgressLoggedAt = lastChunkAt;
            // #region agent log
            agentLog("A,B", "lib/pdf/public-delivery.ts:151", "Public PDF stream made progress", {
              requestId, elapsedMs: lastChunkAt - startedAt, received, length, pullCount,
              throughputBytesPerSecond: Math.round(
                received * 1_000 / Math.max(1, lastChunkAt - startedAt),
              ),
              desiredSize: output.desiredSize,
            });
            // #endregion
          }
          output.enqueue(value);
        } catch (error) {
          // #region agent log
          agentLog("A,B,D", "lib/pdf/public-delivery.ts:163", "Public PDF stream failed", {
            requestId, elapsedMs: Date.now() - startedAt, received, length, pullCount,
            msSinceLastChunk: Date.now() - lastChunkAt, timeoutFired,
            externalAborted: signal?.aborted ?? false,
            error: error instanceof Error ? error.message : String(error),
          });
          // #endregion
          cancel();
          output.error(error);
        }
      },
      cancel() {
        // #region agent log
        agentLog("B,D", "lib/pdf/public-delivery.ts:176", "Downstream cancelled public PDF stream", {
          requestId, elapsedMs: Date.now() - startedAt, received, length, pullCount,
          timeoutFired, externalAborted: signal?.aborted ?? false,
        });
        // #endregion
        controller.abort();
        cancel();
      },
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
    // #region agent log
    agentLog("A,D,E", "lib/pdf/public-delivery.ts:195", "Public PDF setup failed", {
      requestId, elapsedMs: Date.now() - startedAt, received, length, pullCount,
      timeoutFired, externalAborted: signal?.aborted ?? false,
      error: error instanceof Error ? error.message : String(error),
    });
    // #endregion
    console.warn("[pdf-delivery] Public PDF request failed", {
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    controller.abort();
    cancel();
    return errorResponse(502);
  }
}
