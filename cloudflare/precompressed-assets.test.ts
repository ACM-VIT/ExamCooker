import assert from "node:assert/strict";
import test from "node:test";
import { precompressedAssetResponse } from "./precompressed-assets";

const ENGINE = `/vendor/embedpdf/immutable/${"a".repeat(64)}.wasm`;

function assets() {
  const requested: string[] = [];
  const fetcher = {
    async fetch(input: Request | string) {
      const url = new URL(typeof input === "string" ? input : input.url);
      requested.push(url.pathname);
      return url.pathname.endsWith(".br")
        ? new Response("compressed", { headers: { "content-length": "10" } })
        : new Response("raw", { headers: { "content-type": "application/wasm" } });
    },
  } as unknown as Fetcher;
  return { fetcher, requested };
}

test("browsers that accept brotli get the build's precompressed engine", async () => {
  const { fetcher, requested } = assets();
  const response = (await precompressedAssetResponse(new Request(`https://examcooker.acmvit.in${ENGINE}`, {
    headers: { "accept-encoding": "gzip, deflate, br, zstd" },
  }), fetcher))!;
  assert.deepEqual(requested, [`${ENGINE}.br`]);
  assert.equal(response.headers.get("content-encoding"), "br");
  assert.equal(response.headers.get("content-type"), "application/wasm");
  assert.equal(response.headers.get("vary"), "accept-encoding");
  assert.equal(await response.text(), "compressed");
});

test("clients without brotli get the original engine", async () => {
  for (const encoding of ["gzip", "br;q=0, gzip", "identity"]) {
    const { fetcher, requested } = assets();
    const response = (await precompressedAssetResponse(new Request(`https://examcooker.acmvit.in${ENGINE}`, {
      headers: { "accept-encoding": encoding },
    }), fetcher))!;
    assert.deepEqual(requested, [ENGINE]);
    assert.equal(await response.text(), "raw");
  }
});

test("other paths are left to the app", async () => {
  const { fetcher } = assets();
  for (const path of ["/vendor/embedpdf/pdfium.wasm", "/vendor/embedpdf/immutable/x.wasm", "/past_papers"]) {
    assert.equal(await precompressedAssetResponse(new Request(`https://examcooker.acmvit.in${path}`), fetcher), null);
  }
});
