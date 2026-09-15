import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceControlController } from "./voice-runtime";

class Channel extends EventTarget {
  readyState = "open";
  sent: Array<{ type: string }> = [];
  send(value: string) {
    this.sent.push(JSON.parse(value));
  }
  close() {
    this.readyState = "closed";
    this.dispatchEvent(new Event("close"));
  }
  receive(event: object) {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(event) }),
    );
  }
}
class Peer extends EventTarget {
  static latest: Peer;
  channel = new Channel();
  iceGatheringState = "complete";
  connectionState = "connected";
  localDescription = { sdp: "offer" };
  constructor() {
    super();
    Peer.latest = this;
  }
  addTrack() {}
  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { type: "offer", sdp: "offer" };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {
    this.channel.receive({
      type: "session.started",
      session: { id: "live_test" },
    });
  }
  close() {
    this.connectionState = "closed";
  }
}
class AudioElement {
  autoplay = false;
  muted = false;
  srcObject = null;
  async play() {}
  pause() {}
}

test("end drains pending-append errors until session.closed and releases the microphone", async (t) => {
  let stopped = false;
  const track = {
    enabled: true,
    stop() {
      stopped = true;
    },
  };
  const globals = {
    window: { isSecureContext: true, RTCPeerConnection: Peer },
    RTCPeerConnection: Peer,
    Audio: AudioElement,
    navigator: {
      mediaDevices: {
        getUserMedia: async () => ({
          getTracks: () => [track],
          getAudioTracks: () => [track],
        }),
      },
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          session: { id: "live_test" },
          transport: { sdp: "answer", type: "webrtc" },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  const errors: unknown[] = [];
  const controller = createVoiceControlController({
    auth: { sessionEndpoint: "/api/live/session" },
    tools: [],
    onError: (e) => errors.push(e),
  });
  t.after(() => controller.destroy());
  await controller.connect();
  assert.equal(controller.connected, true);
  assert.equal(
    Peer.latest.channel.sent.some((e) => e.type === "session.start"),
    false,
  );
  controller.setMuted(true);
  assert.equal(track.enabled, false);
  controller.setMuted(false);
  assert.equal(track.enabled, true);
  controller.interrupt();
  controller.disconnect();
  const channel = Peer.latest.channel;
  assert.equal(channel.sent.at(-1)?.type, "session.close");
  assert.equal(controller.connected, false);
  assert.equal(stopped, false);
  channel.receive({
    type: "error",
    error: {
      message:
        "The session closed before the estimated context injection completed.",
    },
  });
  assert.deepEqual(errors, []);
  assert.notEqual(controller.getPeerConnection(), null);
  channel.receive({
    type: "session.closed",
    reason: "close_requested",
    usage: { seconds: 12 },
    session: { id: "live_test" },
  });
  assert.equal(controller.getPeerConnection(), null);
  assert.equal(stopped, true);
  assert.equal(channel.readyState, "closed");
});
