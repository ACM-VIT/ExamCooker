import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { downloadPdfZip, settleWithConcurrency } from "./browser-downloads";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

test("batched work keeps input order and never exceeds the limit", async () => {
  let running = 0;
  let peak = 0;
  const results = await settleWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 7 - value));
    running--;
    if (value === 3) throw new Error("three");
    return value * 10;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results.map((result) => result.status === "fulfilled" ? result.value : "failed"), [10, 20, "failed", 40, 50, 60]);
});

test("cancelling a zip stops its downloads and saves nothing", async () => {
  const controller = new AbortController();
  let requests = 0;
  globalThis.fetch = (_url, options) => {
    requests++;
    controller.abort();
    return new Promise((_, reject) => {
      options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      if (options?.signal?.aborted) reject(new DOMException("Aborted", "AbortError"));
    });
  };
  const files = Array.from({ length: 8 }, (_, index) => ({ fileUrl: `https://example.test/${index}.pdf`, fileName: `${index}.pdf` }));
  await assert.rejects(downloadPdfZip({ files, zipFileName: "papers", signal: controller.signal }), { name: "AbortError" });
  assert.equal(requests, 1, "queued downloads do not start after cancellation");
});
