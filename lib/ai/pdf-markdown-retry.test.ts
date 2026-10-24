import assert from "node:assert/strict";
import { test } from "node:test";
import { AiSetupRequiredError, requestPdfMarkdownWithSetup } from "./pdf-markdown-retry";

test("a saved Markdown cache hit does not open AI setup", async () => {
  let setupCalls = 0;
  let requestCalls = 0;
  const result = await requestPdfMarkdownWithSetup(
    async () => { requestCalls += 1; return "saved Markdown"; },
    async () => { setupCalls += 1; return true; },
    new AbortController().signal,
  );

  assert.equal(result, "saved Markdown");
  assert.equal(requestCalls, 1);
  assert.equal(setupCalls, 0);
});

test("a missing key opens setup and retries conversion once", async () => {
  let requestCalls = 0;
  let setupCalls = 0;
  const result = await requestPdfMarkdownWithSetup(
    async () => {
      requestCalls += 1;
      if (requestCalls === 1) throw new AiSetupRequiredError();
      return "converted Markdown";
    },
    async () => { setupCalls += 1; return true; },
    new AbortController().signal,
  );

  assert.equal(result, "converted Markdown");
  assert.equal(requestCalls, 2);
  assert.equal(setupCalls, 1);
});

test("cancelled setup does not retry conversion", async () => {
  let requestCalls = 0;
  const result = await requestPdfMarkdownWithSetup(
    async () => { requestCalls += 1; throw new AiSetupRequiredError(); },
    async () => false,
    new AbortController().signal,
  );

  assert.equal(result, null);
  assert.equal(requestCalls, 1);
});

test("changing documents during setup does not retry the old PDF", async () => {
  const controller = new AbortController();
  let requestCalls = 0;
  const result = await requestPdfMarkdownWithSetup(
    async () => { requestCalls += 1; throw new AiSetupRequiredError(); },
    async () => { controller.abort(); return true; },
    controller.signal,
  );

  assert.equal(result, null);
  assert.equal(requestCalls, 1);
});
