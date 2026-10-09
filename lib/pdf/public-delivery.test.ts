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

test("downstream backpressure does not consume the upstream idle timeout", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const bytes = new Uint8Array(1034);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  let aborted = false;
  globalThis.fetch = async (_url, init) => new Response(new ReadableStream({
    start(output) {
      upstream = output;
      init?.signal?.addEventListener("abort", () => {
        aborted = true;
        output.error(new DOMException("Aborted", "AbortError"));
      });
      output.enqueue(bytes.subarray(0, 1033));
    },
  }), { headers: { "content-length": String(bytes.byteLength) } });

  const response = await servePublicPdf("paper", id);
  const reader = response.body!.getReader();
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(30_000);
  assert.equal(aborted, false);

  assert.equal((await reader.read()).value?.byteLength, 1033);
  upstream.enqueue(bytes.subarray(1033));
  upstream.close();
  assert.equal((await reader.read()).value?.byteLength, 1);
  assert.equal((await reader.read()).done, true);
  assert.equal(aborted, false);
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

test("aborted requests do not contact the upstream", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response("%PDF-1.7"); };
  await servePublicPdf("paper", id, AbortSignal.abort());
  assert.equal(calls, 0);
});
