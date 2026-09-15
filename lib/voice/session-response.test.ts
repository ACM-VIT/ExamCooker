import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as legacySession } from "../../app/api/realtime/session/route";
import { readVoiceSessionResponse, voiceErrorMessage } from "./session-response";

test("old tabs receive a JSON upgrade instruction instead of the HTML 404", async () => {
  const response = legacySession();
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("cache-control"), "no-store");
  // This is how the previous client extracts the toast message.
  const payload = JSON.parse(await response.text());
  assert.match(payload.error, /Refresh this page/);
  assert.ok(payload.error.length < 100);
});

test("HTML failures, redirects, and malformed JSON produce actionable errors", async () => {
  await assert.rejects(readVoiceSessionResponse(new Response(
    '<html><script>self.__next_f.push([1,"_not-found"])</script></html>',
    { status: 404, headers: { "Content-Type": "text/html" } },
  )), /Refresh this page/);
  await assert.rejects(readVoiceSessionResponse(new Response("Bad Gateway", {
    status: 502, headers: { "Content-Type": "text/plain" },
  })), /Voice study is unavailable/);
  await assert.rejects(readVoiceSessionResponse(new Response("{broken", {
    status: 502, headers: { "Content-Type": "application/json" },
  })), /Voice study is unavailable/);
  const redirected = Response.json({});
  Object.defineProperty(redirected, "redirected", { value: true });
  await assert.rejects(readVoiceSessionResponse(redirected), /Sign in again/);
});

test("only short plain-text errors can reach a toast", async () => {
  for (const error of ["<html>error</html>", "x".repeat(301), { message: "nested" }, '["$","div"]']) {
    await assert.rejects(readVoiceSessionResponse(Response.json({ error }, { status: 502 })),
      /Voice study is unavailable/);
    assert.equal(voiceErrorMessage(error), "Voice study is unavailable. Please try again.");
  }
  await assert.rejects(readVoiceSessionResponse(Response.json(
    { error: "Sign in to start your study assistant." }, { status: 401 },
  )), /Sign in to start your study assistant/);
});

test("validate the WebRTC session answer before applying it to the peer", async () => {
  for (const payload of [null, {}, { session: { id: 42 }, transport: { sdp: "answer" } }]) {
    await assert.rejects(readVoiceSessionResponse(Response.json(payload)), /invalid connection answer/);
  }
  const payload = { session: { id: "live_test" }, transport: { type: "webrtc", sdp: "answer" } };
  assert.deepEqual(await readVoiceSessionResponse(Response.json(payload)), payload);
});
