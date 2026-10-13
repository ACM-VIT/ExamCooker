import assert from "node:assert/strict";
import { test } from "node:test";
import { getAssetDeliveryUrl } from "./public-assets";

test("only the Cloudflare asset configuration substitutes public production blobs", () => {
  const source = "https://examcookerprodsi.blob.core.windows.net/exam-assets/past-papers/paper-id/paper.pdf";
  assert.equal(getAssetDeliveryUrl(source, ""), source);
  assert.equal(getAssetDeliveryUrl(source, "https://ec-assets.acmvit.in"), "https://ec-assets.acmvit.in/past-papers/paper-id/paper.pdf");
  for (const original of [
    `${source}?sig=signed`, `${source}#page=2`, source.replace("prodsi", "devsi"),
    source.replace("exam-assets", "private"), source.replace(".blob.core.windows.net", ".blob.core.windows.net.evil.invalid"),
    "data:application/pdf;base64,AA==", "blob:https://examcooker.acmvit.in/test", "/local.pdf",
  ]) assert.equal(getAssetDeliveryUrl(original, "https://ec-assets.acmvit.in"), original);
});
