import assert from "node:assert/strict";
import { test } from "node:test";
import OpenAI from "openai";
import { buildLiveSessionConfig, VOICE_TOOL_DEFINITIONS } from "./config";
import { VoiceSessionOfferSchema } from "./session-offer";

test("OpenAI SDK sends a Live WebRTC session with study tools to the correct endpoint", async () => {
  let requestBody: Record<string, any> | undefined;
  const client = new OpenAI({
    apiKey: "test-only",
    maxRetries: 0,
    fetch: async (url, init) => {
      assert.equal(String(url), "https://api.openai.com/v1/live/sessions");
      requestBody = JSON.parse(init!.body as string);
      return new Response(
        JSON.stringify({
          session: { id: "live_test" },
          transport: { type: "webrtc", sdp: "answer" },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    },
  });
  const browserSdp = "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=extmap-allow-mixed\r\n";
  const offer = VoiceSessionOfferSchema.parse(JSON.parse(JSON.stringify({ sdp: browserSdp })));
  const result = await client.live.create({
    session: buildLiveSessionConfig(),
    transport: { type: "webrtc", sdp: offer.sdp },
  });
  assert.equal(result.session.id, "live_test");
  assert.equal(result.transport.sdp, "answer");
  assert.equal(requestBody!.transport.sdp, browserSdp, "preserve SDP including its final CRLF through validation and the SDK");
  assert.equal(requestBody!.session.model, "gpt-live-1");
  assert.equal(requestBody!.session.audio.output.voice, "sage");
  assert.equal(requestBody!.session.delegation.type, "responses");
  const backend = requestBody!.session.delegation.responses;
  assert.equal(backend.model, "gpt-5.6-terra");
  assert.equal("max_output_tokens" in backend, false);
  assert.deepEqual(
    backend.tools.map((t: { name: string }) => t.name).sort(),
    Object.keys(VOICE_TOOL_DEFINITIONS).sort(),
  );
  assert.equal("turn_detection" in requestBody!.session, false);
  assert.equal("format" in requestBody!.session.audio, false);
  assert.equal(
    requestBody!.session.client.data_channel.allowed_client_events.includes(
      "session.start",
    ),
    false,
  );
});

test("connection offers reject blank, oversized, and unexpected input", () => {
  for (const input of [{ sdp: "" }, { sdp: " \r\n" }, { sdp: "x".repeat(65_537) }, { sdp: 123 }, { sdp: "offer", model: "override" }]) {
    assert.equal(VoiceSessionOfferSchema.safeParse(input).success, false);
  }
});
