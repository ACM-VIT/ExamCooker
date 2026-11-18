import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getPdfDeliveryUrl, getPdfFallbackUrl, publicPdfUpstream } from "./delivery-url";
import { servePublicPdf } from "./public-delivery";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const id = "cmoeqcw9201s8a8v3n2fetot5";

test("delivery only accepts fixed public file locations", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(); };
  for (const [source, file] of [["other", id], ["paper", "short"], ["syllabus", "not-a-course.pdf"], ["syllabus", "BCSE_../file.pdf"]]) {
    assert.equal(publicPdfUpstream(source, file), null);
    assert.equal((await servePublicPdf(source, file)).status, 404);
  }
  for (const url of ["https://other.example/paper.pdf", publicPdfUpstream("paper", id)! + "?sig=test", "/local.pdf"]) {
    assert.equal(getPdfFallbackUrl(url), null);
    assert.equal(getPdfDeliveryUrl(url), url);
  }
  assert.equal(calls, 0);
});

test("public delivery validates split PDF headers and forwards no client credentials", async () => {
  let options: RequestInit | undefined;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, publicPdfUpstream("paper", id));
    options = init;
    return new Response(new ReadableStream({ start(output) {
      for (const chunk of ["%P", "DF-1.7\n", "hello"]) output.enqueue(new TextEncoder().encode(chunk));
      output.close();
    } }));
  };
  const response = await servePublicPdf("paper", id);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "%PDF-1.7\nhello");
  assert.equal(options?.redirect, "manual");
  assert.deepEqual(options?.headers, { Accept: "application/pdf" });
  assert.match(response.headers.get("content-type")!, /application\/pdf/);
  assert.match(response.headers.get("cache-control")!, /public/);
});

test("missing, invalid, oversize, and unavailable upstream files are never cached", async () => {
  for (const [upstream, expected] of [
    [new Response("missing", { status: 404 }), 404],
    [new Response("error", { status: 503 }), 502],
    [new Response(null, { status: 302, headers: { location: "https://other.example/file.pdf" } }), 502],
    [new Response("<html>error</html>"), 502],
    [new Response("%PDF-1.7", { headers: { "content-length": String(33 * 1024 * 1024) } }), 502],
  ] as const) {
    globalThis.fetch = async () => upstream;
    const response = await servePublicPdf("paper", id);
    assert.equal(response.status, expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("truncated upstream PDF fails instead of completing a successful download", async () => {
  globalThis.fetch = async () => new Response("%PDF-1.7\nshort", { headers: { "content-length": "2048" } });
  const response = await servePublicPdf("paper", id);
  await assert.rejects(response.arrayBuffer(), /Incomplete PDF/);
});

test("decoded response bodies do not reuse the compressed content length", async () => {
  globalThis.fetch = async () => new Response("%PDF-1.7\ndecoded", {
    headers: { "content-encoding": "gzip", "content-length": "35" },
  });
  const response = await servePublicPdf("paper", id);
  assert.equal(response.headers.get("content-length"), null);
  assert.equal(await response.text(), "%PDF-1.7\ndecoded");
});

// Like fetch, the body fails once the request's signal aborts.
function streamingUpstream(chunks: string[], signal: AbortSignal | null | undefined, options = { stall: false }) {
  const queue = [...chunks];
  return new Response(new ReadableStream({
    start(output) {
      signal?.addEventListener("abort", () => output.error(new DOMException("The operation was aborted.", "AbortError")));
    },
    pull(output) {
      const chunk = queue.shift();
      if (chunk !== undefined) return output.enqueue(new TextEncoder().encode(chunk));
      if (options.stall) return new Promise<void>(() => {});
      output.close();
    },
  }));
}

test("a slow reader still receives the whole PDF", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const chunks = [`%PDF-1.7\n${"a".repeat(2048)}`, "b".repeat(2048), "c".repeat(2048)];
  globalThis.fetch = async (_url, init) => streamingUpstream(chunks, init?.signal);
  const response = await servePublicPdf("paper", id);
  const reader = response.body!.getReader();
  let received = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += new TextDecoder().decode(value);
    // The client takes longer than the timeout to ask for the next chunk.
    t.mock.timers.tick(31_000);
  }
  assert.equal(received, chunks.join(""));
});

test("an upstream that stops sending mid-file fails the download", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  globalThis.fetch = async (_url, init) =>
    streamingUpstream([`%PDF-1.7\n${"a".repeat(2048)}`], init?.signal, { stall: true });
  const response = await servePublicPdf("paper", id);
  const reader = response.body!.getReader();
  await reader.read();
  const next = reader.read();
  // Let the stream ask the upstream for the next chunk before time passes.
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(30_000);
  await assert.rejects(next, /abort/i);
});

test("aborted requests do not contact the upstream", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("%PDF-1.7"); };
  await servePublicPdf("paper", id, AbortSignal.abort());
  assert.equal(calls, 0);
});
