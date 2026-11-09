import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { z } from "zod";
import { createVoiceControlController, defineVoiceTool } from "./voice-runtime";
import type { UseVoiceControlOptions, VoiceControlError } from "./voice-runtime";

class Channel extends EventTarget {
  readyState = "open";
  sent: Array<{ type: string }> = [];
  send(value: string) {
    this.sent.push(JSON.parse(value));
  }
  close() {
    if (this.readyState === "closed") return;
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
  static latest: AudioElement;
  static play: () => Promise<void> = async () => {};
  autoplay = false;
  muted = false;
  srcObject: unknown = null;
  constructor() {
    AudioElement.latest = this;
  }
  play() {
    return AudioElement.play();
  }
  pause() {}
}
class FakeMediaStream {
  constructor(readonly tracks: unknown[]) {}
}

function installBrowser(t: TestContext) {
  const track = {
    enabled: true,
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
  AudioElement.play = async () => {};
  const globals = {
    window: { isSecureContext: true, RTCPeerConnection: Peer },
    RTCPeerConnection: Peer,
    Audio: AudioElement,
    MediaStream: FakeMediaStream,
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
  return track;
}

function createController(
  t: TestContext,
  options: Partial<UseVoiceControlOptions> = {},
) {
  const errors: Array<{ error: VoiceControlError; fatal: boolean }> = [];
  const controller = createVoiceControlController({
    auth: { sessionEndpoint: "/api/live/session" },
    tools: [],
    onError: (error, { fatal }) => errors.push({ error, fatal }),
    ...options,
  });
  t.after(() => controller.destroy());
  return { controller, errors };
}

function responseEvent(event: object) {
  return { type: "response.event", delegation_id: "d1", event };
}

test("end drains pending-append errors until session.closed and releases the microphone", async (t) => {
  const track = installBrowser(t);
  const { controller, errors } = createController(t);
  await controller.connect();
  assert.equal(controller.connected, true);
  assert.equal(controller.activity, "listening");
  controller.setMuted(true);
  assert.equal(track.enabled, false);
  controller.setMuted(false);
  assert.equal(track.enabled, true);
  controller.interrupt();
  controller.disconnect();
  const channel = Peer.latest.channel;
  assert.equal(channel.sent.at(-1)?.type, "session.close");
  assert.equal(controller.connected, false);
  assert.equal(controller.activity, "closing");
  assert.equal(track.stopped, false);
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
  assert.equal(controller.activity, "idle");
  assert.equal(controller.getPeerConnection(), null);
  assert.equal(track.stopped, true);
  assert.equal(channel.readyState, "closed");
});

test("a channel that closes while finalizing ends the session without an error", async (t) => {
  const track = installBrowser(t);
  const { controller, errors } = createController(t);
  await controller.connect();
  controller.disconnect();
  Peer.latest.channel.close();
  assert.deepEqual(errors, []);
  assert.equal(controller.activity, "idle");
  assert.equal(track.stopped, true);
});

test("a channel that closes during a live session is a fatal error", async (t) => {
  installBrowser(t);
  const { controller, errors } = createController(t);
  await controller.connect();
  Peer.latest.channel.close();
  assert.equal(controller.activity, "error");
  assert.equal(controller.connected, false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fatal, true);
});

test("a microphone that aborts while connecting ends the attempt with an error", async (t) => {
  installBrowser(t);
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          throw new DOMException("Starting audio input failed.", "AbortError");
        },
      },
    },
  });
  const { controller, errors } = createController(t);
  await controller.connect();
  assert.equal(controller.activity, "error");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].fatal, true);
});

test("starting again while the previous session finalizes waits for it", async (t) => {
  installBrowser(t);
  const { controller, errors } = createController(t);
  await controller.connect();
  const first = Peer.latest;
  controller.disconnect();
  await controller.connect();
  assert.equal(Peer.latest, first, "no second connection is opened");
  assert.equal(controller.activity, "closing");
  assert.deepEqual(errors, []);
});

test("playback interrupted by teardown is not reported as blocked audio", async (t) => {
  installBrowser(t);
  let rejectPlay!: (error: unknown) => void;
  AudioElement.play = () =>
    new Promise<void>((_, reject) => {
      rejectPlay = reject;
    });
  const { controller, errors } = createController(t);
  await controller.connect();
  Peer.latest.dispatchEvent(
    Object.assign(new Event("track"), { track: { kind: "audio" } }),
  );
  controller.disconnect();
  Peer.latest.channel.receive({
    type: "session.closed",
    reason: "close_requested",
    usage: { seconds: 1 },
    session: { id: "live_test" },
  });
  rejectPlay(new DOMException("The play() request was interrupted.", "AbortError"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(errors, []);
  assert.equal(controller.activity, "idle");
});

test("a tool still running when the session ends is marked skipped", async (t) => {
  installBrowser(t);
  let finishTool!: () => void;
  const tool = defineVoiceTool({
    name: "inspect_current_view",
    description: "Inspect the view.",
    parameters: z.object({}),
    execute: () =>
      new Promise((resolve) => {
        finishTool = () => resolve({ ok: true });
      }),
  });
  const { controller } = createController(t, { tools: [tool] });
  await controller.connect();
  const channel = Peer.latest.channel;
  channel.receive(
    responseEvent({ type: "response.created", response: { id: "r1", output: [] } }),
  );
  channel.receive(
    responseEvent({
      type: "response.output_item.done",
      item: {
        type: "function_call",
        name: "inspect_current_view",
        call_id: "c1",
        arguments: "{}",
      },
    }),
  );
  channel.receive(
    responseEvent({ type: "response.completed", response: { id: "r1", output: [] } }),
  );
  for (let i = 0; i < 5 && controller.activity !== "executing"; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(controller.activity, "executing");
  assert.equal(controller.latestToolCall?.status, "running");

  channel.close();
  assert.equal(controller.latestToolCall?.status, "skipped");
  assert.deepEqual(
    controller.toolCalls.map((call) => call.status),
    ["skipped"],
  );
  finishTool();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(controller.latestToolCall?.status, "skipped");
});
