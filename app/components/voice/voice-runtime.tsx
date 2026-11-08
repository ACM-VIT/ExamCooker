"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toJSONSchema } from "zod";
import type {
  ClientEvent,
  ServerEvent,
} from "openai/resources/live/live";
import type { ResponseStreamEvent } from "openai/resources/responses/responses";
import { VOICE_MODEL, VOICE_BACKEND_MODEL } from "@/lib/voice/config";
import { readVoiceSessionResponse, voiceErrorMessage } from "@/lib/voice/session-response";
import {
  createVoiceToolInputGuardrail,
  parseVoiceToolInput,
} from "./voice-runtime-guardrails";
import {
  LiveResponseHandler,
  type LiveFunctionCall,
} from "./voice-live-responses";
import type {
  JsonSchema,
  UseVoiceControlOptions,
  UseVoiceControlReturn,
  VoiceControlActivity,
  VoiceControlController,
  VoiceControlError,
  VoiceControlErrorCode,
  VoiceControlSnapshot,
  VoiceTool,
  VoiceToolCallRecord,
  VoiceToolDefinition,
} from "./voice-runtime-types";
export type * from "./voice-runtime-types";

export function defineVoiceTool<TArgs>(
  definition: VoiceToolDefinition<TArgs>,
): VoiceTool<TArgs> {
  const { $schema, ...schema } = toJSONSchema(definition.parameters);
  const jsonSchema = schema as JsonSchema;
  return {
    ...definition,
    jsonSchema,
    realtimeTool: {
      type: "function",
      name: definition.name,
      description: definition.description,
      parameters: jsonSchema,
    },
    parseArguments: (raw) =>
      definition.parameters.parse(JSON.parse(raw || "{}")),
  };
}

const LIVE_ACTIVITIES: ReadonlySet<VoiceControlActivity> = new Set([
  "listening",
  "processing",
  "executing",
]);

class VoiceStartError extends Error {
  constructor(
    readonly code: VoiceControlErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function abortError() {
  return new DOMException("Voice startup cancelled.", "AbortError");
}
function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
function errorDetails(error: unknown): VoiceControlError {
  const message =
    voiceErrorMessage(error instanceof Error ? error.message : undefined);
  if (error instanceof VoiceStartError) return { message, code: error.code };
  const name = error instanceof Error ? error.name : "";
  return {
    message,
    code:
      name === "NotAllowedError"
        ? "permission_denied"
        : name === "NotFoundError"
          ? "device_unavailable"
          : name === "AbortError"
            ? "aborted"
            : "network_error",
  };
}
type SnapshotPatch = Partial<
  Omit<VoiceControlSnapshot, "activity" | "connected">
>;

// A session that ends while a tool runs never reports that tool's result.
function skipRunning(record: VoiceToolCallRecord): VoiceToolCallRecord {
  return record.status === "running" ? { ...record, status: "skipped" } : record;
}

// Tools run one at a time, so a tool that never settles would block every
// later one. This bound sits above the server-side AI timeout (120 s) and only
// catches promises that would otherwise never settle.
const TOOL_TIMEOUT_MS = 150_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function waitFor(
  target: EventTarget,
  event: string,
  ready: () => boolean,
  signal: AbortSignal,
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      target.removeEventListener(event, check);
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const check = () => {
      if (ready()) finish();
    };
    const abort = () => finish(abortError());
    const timeout = setTimeout(
      () => finish(new Error("Voice connection timed out. Please try again.")),
      timeoutMs,
    );
    target.addEventListener(event, check);
    signal.addEventListener("abort", abort, { once: true });
    signal.aborted ? abort() : check();
  });
}

class VoiceControlControllerImpl implements VoiceControlController {
  private options: UseVoiceControlOptions;
  private snapshot: VoiceControlSnapshot;
  private listeners = new Set<() => void>();
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSamples = new Uint8Array(256);
  private abort: AbortController | null = null;
  private responses: LiveResponseHandler | null = null;
  private generation = 0;
  private destroyed = false;
  private runningToolId: string | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private sessionId: string | null = null;
  private inputTranscript = "";
  private lastContext = "";
  private voiceSeconds = 0;
  private responseMetrics = new Map<
    string,
    { startedAt: number; text: string; firstTokenAt?: number; input: string }
  >();

  constructor(options: UseVoiceControlOptions) {
    this.options = options;
    this.snapshot = {
      activity: "idle",
      connected: false,
      muted: false,
      toolCalls: [],
      latestToolCall: null,
      sessionConfig: this.resolveConfig(options),
    };
  }
  private resolveConfig(options: UseVoiceControlOptions) {
    return {
      model: VOICE_MODEL,
      tools: options.tools.map((t) => t.realtimeTool),
      activationMode: "vad" as const,
      outputMode: "audio" as const,
      audio: options.audio,
    };
  }
  get activity() {
    return this.snapshot.activity;
  }
  get connected() {
    return this.snapshot.connected;
  }
  get muted() {
    return this.snapshot.muted;
  }
  get toolCalls() {
    return this.snapshot.toolCalls;
  }
  get latestToolCall() {
    return this.snapshot.latestToolCall;
  }
  get sessionConfig() {
    return this.snapshot.sessionConfig;
  }
  getSnapshot = () => this.snapshot;
  getPeerConnection = () => this.peer;
  getOutputAudioLevel = () => {
    if (!this.connected || this.audio?.muted || !this.analyser) return 0;
    this.analyser.getByteTimeDomainData(this.audioSamples);
    let sum = 0;
    for (const sample of this.audioSamples) sum += ((sample - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / this.audioSamples.length) * 8);
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private get live() {
    return LIVE_ACTIVITIES.has(this.activity);
  }
  private get closing() {
    return this.activity === "closing";
  }
  private commit(snapshot: VoiceControlSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  private update(patch: SnapshotPatch) {
    this.commit({ ...this.snapshot, ...patch });
  }
  // The only writer of activity, so `connected` always follows it.
  private setActivity(activity: VoiceControlActivity, patch: SnapshotPatch = {}) {
    this.commit({
      ...this.snapshot,
      ...patch,
      activity,
      connected: LIVE_ACTIVITIES.has(activity),
    });
  }
  // Tear the session down and settle on a terminal activity.
  private end(activity: "idle" | "error") {
    this.cleanup();
    this.setActivity(activity, { muted: false, ...this.skippedToolCalls() });
  }
  private skippedToolCalls() {
    return {
      toolCalls: this.toolCalls.map(skipRunning),
      latestToolCall: this.latestToolCall && skipRunning(this.latestToolCall),
    };
  }
  configure = (options: UseVoiceControlOptions) => {
    this.options = options;
    this.update({ sessionConfig: this.resolveConfig(options) });
  };
  private report(error: unknown, fatal = false) {
    const detail = errorDetails(error);
    // Aborts this controller causes never reach here as fatal: callers check
    // `current()` first. A fatal AbortError comes from elsewhere (a device
    // failing after permission) and must still end the session.
    if (detail.code === "aborted" && !fatal) return;
    if (fatal) this.end("error");
    this.options.onError?.(detail, { fatal });
  }

  connect = async () => {
    // Only a settled session can start another. While closing, the previous
    // session is still finalizing; the UI shows that state and waits for it.
    if (
      this.destroyed ||
      (this.activity !== "idle" && this.activity !== "error")
    )
      return;
    this.cleanup();
    const generation = ++this.generation;
    const abort = new AbortController();
    this.abort = abort;
    this.setActivity("connecting", {
      muted: false,
      toolCalls: [],
      latestToolCall: null,
    });
    const current = () =>
      generation === this.generation && !abort.signal.aborted;
    // The data channel or peer went away. While closing, that ends
    // finalization; at any other time the session was lost.
    const lost = (message: string) => {
      if (!current()) return;
      if (this.closing) this.end("idle");
      else this.report(new Error(message), true);
    };
    try {
      if (!window.isSecureContext)
        throw new VoiceStartError(
          "insecure_context",
          "Voice study needs HTTPS or localhost.",
        );
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
        throw new VoiceStartError(
          "unsupported_browser",
          "This browser does not support voice study.",
        );
      if (window.AudioContext) {
        this.audioContext = new window.AudioContext();
        void this.audioContext.resume().catch(() => {
          /* Audio playback still uses the media element. */
        });
      }
      // Request permission from the user's start action; dispose late permission grants.
      const media = await navigator.mediaDevices.getUserMedia({
        audio: this.options.audio?.input?.capture ?? true,
      });
      if (!current()) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      this.microphone = media;
      const peer = new RTCPeerConnection();
      this.peer = peer;
      const audio = new Audio();
      audio.autoplay = true;
      this.audio = audio;
      peer.addEventListener("track", ({ track }) => {
        if (!current()) return;
        const stream = new MediaStream([track]);
        audio.srcObject = stream;
        if (this.audioContext) {
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = this.audioSamples.length;
          // Observe output without connecting to the destination a second time.
          this.audioContext
            .createMediaStreamSource(stream)
            .connect(this.analyser);
        }
        void audio.play().catch((error: unknown) => {
          // Teardown or a replaced source interrupts play() with AbortError.
          if (!current() || isAbortError(error)) return;
          this.report(
            new Error(
              "Audio playback was blocked. End voice study and start it again to enable playback.",
            ),
            true,
          );
        });
      });
      media.getAudioTracks().forEach((track) => peer.addTrack(track, media));
      const channel = peer.createDataChannel("oai-events");
      this.channel = channel;
      this.responses = new LiveResponseHandler({
        execute: (call) => this.executeTool(call, generation),
        send: (event) => this.sendClientEvent(event),
        onError: (error) => this.report(error),
        onEvent: (event) => this.recordBackendEvent(event),
      });
      channel.addEventListener("message", ({ data }) => {
        if (!current()) return;
        try {
          this.handleEvent(JSON.parse(data) as ServerEvent);
        } catch (error) {
          this.report(error, true);
        }
      });
      channel.addEventListener("close", () =>
        lost("Voice connection closed before finalization. Please reconnect."),
      );
      peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "failed")
          lost("Voice connection was lost. Please reconnect.");
      });
      await peer.setLocalDescription(await peer.createOffer());
      await waitFor(
        peer,
        "icegatheringstatechange",
        () => peer.iceGatheringState === "complete",
        abort.signal,
        10_000,
      );
      if (!current()) return;
      const sdp = peer.localDescription?.sdp;
      if (!sdp)
        throw new Error(
          "The browser could not create a voice connection offer.",
        );
      const headers = new Headers(this.options.auth.sessionRequestInit?.headers);
      headers.set("Content-Type", "application/json");
      headers.set("Accept", "application/json");
      const response = await fetch(this.options.auth.sessionEndpoint, {
        ...this.options.auth.sessionRequestInit,
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({ sdp }),
        signal: abort.signal,
      });
      const result = await readVoiceSessionResponse(response);
      if (!current()) return;
      this.sessionId = result.session.id;
      await peer.setRemoteDescription({
        type: "answer",
        sdp: result.transport.sdp,
      });
      // The HTTP exchange starts Live. Data-channel open alone is not readiness.
      await waitFor(channel, "message", () => this.live, abort.signal, 20_000);
    } catch (error) {
      if (current()) this.report(error, true);
    }
  };

  private handleEvent(event: ServerEvent) {
    switch (event.type) {
      case "session.started":
        if (this.activity !== "connecting") break;
        this.sessionId = event.session.id;
        this.setActivity("listening");
        this.append(
          "session.instructions.append",
          "Welcome the student naturally. Use the available context to help them pick up where they left off or find out what they want to work on.",
        );
        break;
      case "session.input_transcript.delta":
        if (this.audio && !this.closing) this.audio.muted = false;
        this.inputTranscript = (this.inputTranscript + event.delta).slice(
          -4000,
        );
        break;
      case "session.delegation.created":
        if (this.live && !this.runningToolId) this.setActivity("processing");
        break;
      case "response.event":
        if (!this.closing) this.responses?.handle(event);
        break;
      case "session.usage.updated":
        this.voiceSeconds = event.usage.seconds;
        break;
      case "session.closed":
        this.voiceSeconds = event.usage.seconds;
        if (this.options.debug)
          console.debug("[voice-agent] Live session finalized", {
            seconds: this.voiceSeconds,
            reason: event.reason,
          });
        this.end("idle");
        break;
      case "error":
        // Closing rejects pending context appends. Keep draining until
        // session.closed instead of tearing down before final usage arrives.
        if (this.closing) break;
        this.report(new Error(event.error.message), true);
        break;
    }
  }

  private async executeTool(call: LiveFunctionCall, generation: number) {
    const active = () => this.live && generation === this.generation;
    if (!active())
      return JSON.stringify({ ok: false, error: "The study session ended." });
    const tool = this.options.tools.find((tool) => tool.name === call.name);
    if (!tool)
      return JSON.stringify({
        ok: false,
        error: "This study tool is unavailable.",
      });
    const startedAt = Date.now();
    const record = {
      id: call.call_id,
      sequence: this.toolCalls.length + 1,
      name: call.name,
      status: "running" as const,
      startedAt,
    };
    this.runningToolId = call.call_id;
    this.setActivity("executing", {
      toolCalls: [...this.toolCalls, record],
      latestToolCall: record,
    });
    let output: unknown;
    let args: unknown;
    let failure: VoiceControlError | undefined;
    try {
      const guardrail = await createVoiceToolInputGuardrail(tool).run({
        toolCall: call,
      });
      if (guardrail.behavior.type === "rejectContent")
        throw new Error(guardrail.behavior.message);
      if (!active()) throw abortError();
      args = parseVoiceToolInput(tool, JSON.parse(call.arguments || "{}"));
      output = await withTimeout(
        Promise.resolve(tool.execute(args)),
        TOOL_TIMEOUT_MS,
        "This study tool took too long to respond.",
      );
      if (
        output &&
        typeof output === "object" &&
        "ok" in output &&
        output.ok === false
      ) {
        const result = output as { error?: unknown; message?: unknown };
        const message = result.error ?? result.message;
        failure = {
          message:
            typeof message === "string"
              ? message
              : "The study tool could not complete this request.",
        };
      }
    } catch (error) {
      failure = errorDetails(error);
      output = { ok: false, error: failure.message };
    }
    if (generation === this.generation && this.runningToolId === call.call_id)
      this.runningToolId = null;
    if (active()) {
      const finished = {
        ...record,
        args,
        status: failure ? ("error" as const) : ("success" as const),
        output,
        error: failure,
        finishedAt: Date.now(),
        durationMs: Date.now() - startedAt,
      };
      this.setActivity("processing", {
        toolCalls: this.toolCalls.map((r) =>
          r.id === call.call_id ? finished : r,
        ),
        latestToolCall: finished,
      });
    }
    return JSON.stringify(output ?? { ok: true });
  }

  private recordBackendEvent(event: ResponseStreamEvent) {
    if (event.type === "response.created") {
      this.responseMetrics.set(event.response.id, {
        startedAt: Date.now(),
        text: "",
        input: this.inputTranscript || "Study assistance",
      });
    } else if (event.type === "response.output_text.delta") {
      const metric = Array.from(this.responseMetrics.values()).at(-1);
      if (metric) {
        metric.text = (metric.text + event.delta).slice(0, 8000);
        metric.firstTokenAt ??= Date.now();
      }
    } else if (
      ["response.completed", "response.failed", "response.incomplete"].includes(
        event.type,
      ) &&
      "response" in event
    ) {
      const response = event.response;
      const metric = this.responseMetrics.get(response.id);
      if (metric) {
        this.options.onGenerationCompleted?.({
          conversationId: this.sessionId,
          responseId: response.id,
          model: response.model || VOICE_BACKEND_MODEL,
          inputText: metric.input,
          outputText: metric.text || null,
          status: response.status ?? "unknown",
          latencyMs: Date.now() - metric.startedAt,
          timeToFirstTokenMs: metric.firstTokenAt
            ? metric.firstTokenAt - metric.startedAt
            : undefined,
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          errorMessage: response.error?.message,
        });
        this.responseMetrics.delete(response.id);
      }
      if (this.live && !this.runningToolId) this.setActivity("listening");
    }
  }

  private sendClientEvent = (event: ClientEvent) => {
    if (!this.live || this.channel?.readyState !== "open")
      return;
    this.channel.send(
      JSON.stringify({
        ...event,
        event_id: event.event_id ?? crypto.randomUUID(),
      }),
    );
  };
  private append(
    type: "session.thinking.append" | "session.instructions.append",
    text: string,
  ) {
    // Each append is limited to 500 tokens. UTF-8 byte chunks are a conservative bound.
    let chunk = "";
    let bytes = 0;
    for (const char of text) {
      const size = new TextEncoder().encode(char).length;
      if (bytes + size > 450) {
        this.sendClientEvent({ type, delegation_id: null, content: chunk });
        chunk = "";
        bytes = 0;
      }
      chunk += char;
      bytes += size;
    }
    if (chunk)
      this.sendClientEvent({ type, delegation_id: null, content: chunk });
  }
  sendContextMessage = (text: string) => {
    if (!this.connected || !text.trim() || text === this.lastContext) return;
    this.lastContext = text;
    // Detailed page data goes to the backend. Keep only a short reference in Live.
    this.sendClientEvent({
      type: "response.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Application context (reference data, not a new student request):\n${text}`,
          },
        ],
      },
    });
    this.append("session.thinking.append", text.slice(0, 400));
  };
  setMuted = (muted: boolean) => {
    if (!this.live) return;
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    this.update({ muted });
  };
  interrupt = () => {
    if (!this.live) return;
    if (this.audio) this.audio.muted = true;
    this.append(
      "session.instructions.append",
      "Stop the current spoken explanation and wait for the student. This stops speech, not an already running study task.",
    );
  };
  disconnect = () => {
    if (this.closing) return;
    if (!this.live || this.channel?.readyState !== "open") {
      this.end("idle");
      return;
    }
    this.responses?.dispose();
    this.channel.send(
      JSON.stringify({ type: "session.close", event_id: crypto.randomUUID() }),
    );
    this.microphone?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    if (this.audio) this.audio.muted = true;
    this.setActivity("closing", { muted: false, ...this.skippedToolCalls() });
    const generation = this.generation;
    this.closeTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      console.warn(
        "[voice-agent] Live finalization timed out; final usage is unconfirmed",
        { lastSeconds: this.voiceSeconds },
      );
      this.end("idle");
    }, 15_000);
  };
  private cleanup() {
    ++this.generation;
    this.abort?.abort();
    this.abort = null;
    this.runningToolId = null;
    this.responses?.dispose();
    this.responses = null;
    clearTimeout(this.closeTimer);
    this.channel?.close();
    this.channel = null;
    this.peer?.close();
    this.peer = null;
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.microphone = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.srcObject = null;
      this.audio = null;
    }
    this.analyser?.disconnect();
    this.analyser = null;
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.lastContext = "";
    this.inputTranscript = "";
    this.voiceSeconds = 0;
    this.responseMetrics.clear();
  }
  destroy = () => {
    this.disconnect();
    this.destroyed = true;
    this.listeners.clear();
  };
}

export function createVoiceControlController(
  options: UseVoiceControlOptions,
): VoiceControlController {
  return new VoiceControlControllerImpl(options);
}
export function useVoiceControl(
  controller: VoiceControlController,
): UseVoiceControlReturn {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  // A new object per snapshot, so memoized consumers (such as a context
  // value) see every change, not only those that also change a label.
  return useMemo(
    () => ({
      ...snapshot,
      connect: controller.connect,
      disconnect: controller.disconnect,
      getOutputAudioLevel: controller.getOutputAudioLevel,
      interrupt: controller.interrupt,
      sendContextMessage: controller.sendContextMessage,
      setMuted: controller.setMuted,
    }),
    [controller, snapshot],
  );
}
