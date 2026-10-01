import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(import.meta.resolve("wrangler/package.json"));
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const { build } = require("esbuild");

const { outputFiles } = await build({
  stdin: { resolveDir: resolve("."), contents: `
    import { servePublicPdf } from "./lib/pdf/public-delivery.ts";
    let redirect = false;
    globalThis.fetch = async (url, init) => {
      // Exercise workerd's actual Request validation (Node accepts redirect:
      // "error", but workerd rejects it before making any network request).
      const request = new Request(url, init);
      if (request.redirect !== "manual") throw Error("Redirects must not be followed");
      return redirect
        ? new Response(null, { status: 302, headers: { location: "https://other.invalid/file.pdf" } })
        : new Response("%PDF-1.7\\nworker fixture");
    };
    export default { async fetch(request) {
      redirect = new URL(request.url).pathname === "/redirect";
      return servePublicPdf("paper", "cmoeqcw9201s8a8v3n2fetot5", request.signal);
    } };
  ` },
  bundle: true, write: false, format: "esm", platform: "browser",
});
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true, script: outputFiles[0].text,
  compatibilityDate: "2026-09-10", compatibilityFlags: ["nodejs_compat"],
}));
try {
  const pdf = await mf.dispatchFetch("http://localhost/pdf");
  assert.equal(pdf.status, 200);
  assert.equal(await pdf.text(), "%PDF-1.7\nworker fixture");
  const redirected = await mf.dispatchFetch("http://localhost/redirect");
  assert.equal(redirected.status, 502);
  assert.equal(redirected.headers.get("cache-control"), "no-store");
  console.log("PASS: public PDFs stream in workerd; upstream redirects are rejected without following them");
} finally {
  await mf.dispose();
}
