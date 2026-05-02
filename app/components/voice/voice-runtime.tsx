"use client";

import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
  tool as createRealtimeTool,
  type RealtimeSessionConfig,
} from "@openai/agents/realtime";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { toJSONSchema, type ZodType } from "zod";

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: readonly string[];
  enum?: readonly unknown[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
};

type RealtimeServerEvent = {
  type: string;
  [key: string]: unknown;
};

export type RealtimeClientEvent = {
  type: string;
  [key: string]: unknown;
};

type ToolCallStatus = "running" | "success" | "error" | "skipped";
type VoiceControlErrorCode =
  | "active_response"
  | "aborted"
  | "device_unavailable"
  | "invalid_tool_input"
  | "insecure_context"
  | "network_error"
  | "permission_denied"
  | "unknown"
  | "unsupported_browser";

export type VoiceControlError = {
  code?: VoiceControlErrorCode;
  message: string;
  cause?: unknown;
};

export type VoiceControlActivity =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "executing"
  | "error";

export type VoiceControlStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "error";

export type ActivationMode = "push-to-talk" | "vad";
export type OutputMode = "tool-only" | "text" | "audio" | "text+audio";
export type RealtimeAudioFormat = "pcm16" | "g711_ulaw" | "g711_alaw";
export type RealtimeVoice =
  | "alloy"
  | "ash"
  | "ballad"
  | "cedar"
  | "coral"
  | "echo"
  | "marin"
  | "sage"
  | "shimmer"
  | "verse"
  | (string & {});

export type RealtimeTurnDetection =
  | {
      type: "server_vad";
      createResponse?: boolean;
      interruptResponse?: boolean;
      prefixPaddingMs?: number;
      silenceDurationMs?: number;
      threshold?: number;
    }
  | {
      type: "semantic_vad";
      createResponse?: boolean;
      interruptResponse?: boolean;
      eagerness?: "low" | "medium" | "high" | "auto";
    };

export type RealtimeAudioConfig = {
  input?: {
    format?: RealtimeAudioFormat;
    turnDetection?: RealtimeTurnDetection | null;
  };
  output?: {
    format?: RealtimeAudioFormat;
    speed?: number;
    voice?: RealtimeVoice;
  };
};

export type VoiceToolDefinition<TArgs = unknown> = {
  name: string;
  description: string;
  parameters: ZodType<TArgs>;
  execute: (args: TArgs) => Promise<unknown> | unknown;
};

type RealtimeFunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: JsonSchema;
};

export type VoiceTool<TArgs = unknown> = VoiceToolDefinition<TArgs> & {
  jsonSchema: JsonSchema;
  realtimeTool: RealtimeFunctionTool;
  parseArguments: (rawArgs: string) => TArgs;
};

export type VoiceToolCallRecord = {
  id: string;
  sequence: number;
  name: string;
  status: ToolCallStatus;
  args?: unknown;
  output?: unknown;
  error?: VoiceControlError;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
};

type VoiceControlResolvedSessionConfig = {
  model: string;
  instructions: string;
  tools: RealtimeFunctionTool[];
  activationMode: ActivationMode;
  outputMode: OutputMode;
  audio?: RealtimeAudioConfig;
  maxOutputTokens?: number | "inf";
};

export type UseVoiceControlOptions = {
  auth: {
    sessionEndpoint: string;
    sessionRequestInit?: RequestInit;
  };
  tools: VoiceTool<any>[];
  instructions?: string;
  model?: string;
  activationMode?: ActivationMode;
  outputMode?: OutputMode;
  audio?: RealtimeAudioConfig;
  maxOutputTokens?: number | "inf";
  postToolResponse?: boolean;
  debug?: boolean;
  onGenerationCompleted?: (generation: VoiceControlGeneration) => void;
  onError?: (error: VoiceControlError) => void;
};

export type VoiceControlGeneration = {
  conversationId?: string | null;
  errorMessage?: string;
  inputText: string;
  inputTokens?: number;
  latencyMs: number;
  model: string;
  outputText: string | null;
  outputTokens?: number;
  responseId?: string | null;
  status: string;
  stopReason?: string;
  timeToFirstTokenMs?: number;
};

type VoiceControlSnapshot = {
  status: VoiceControlStatus;
  activity: VoiceControlActivity;
  connected: boolean;
  muted: boolean;
  transcript: string;
  toolCalls: VoiceToolCallRecord[];
  latestToolCall: VoiceToolCallRecord | null;
  sessionConfig: VoiceControlResolvedSessionConfig;
};

export type UseVoiceControlReturn = VoiceControlSnapshot & {
  connect: () => Promise<void>;
  disconnect: () => void;
  setMuted: (muted: boolean) => void;
  requestResponse: () => void;
  sendClientEvent: (event: RealtimeClientEvent) => void;
};

export type VoiceControlController = UseVoiceControlReturn & {
  configure: (options: UseVoiceControlOptions) => void;
  destroy: () => void;
  getPeerConnection: () => RTCPeerConnection | null;
  getSnapshot: () => VoiceControlSnapshot;
  subscribe: (listener: () => void) => () => void;
};

type GhostCursorPhase = "hidden" | "traveling" | "arrived";
type GhostCursorState = {
  visible: boolean;
  phase: GhostCursorPhase;
  x: number;
  y: number;
};

type GhostCursorTarget = {
  element?: HTMLElement | null;
  point?: {
    x: number;
    y: number;
  };
  pulseElement?: HTMLElement | null;
};

type GhostCursorMotionOptions = {
  easing?: "smooth" | "expressive";
  from?: "pointer" | "previous" | { x: number; y: number };
};

type UseGhostCursorReturn = {
  cursorState: GhostCursorState;
  hide: () => void;
  run: <TResult>(
    target: GhostCursorTarget,
    operation: () => Promise<TResult> | TResult,
    options?: GhostCursorMotionOptions,
  ) => Promise<TResult>;
};

type MutableRealtimeSession<TContext = unknown> = RealtimeSession<TContext> & {
  options: {
    model?: string;
    config?: Partial<RealtimeSessionConfig>;
    [key: string]: unknown;
  };
};

const DEFAULT_MODEL = "gpt-realtime-mini";
const DEFAULT_INSTRUCTIONS =
  "You are a voice control agent for a web app. Use registered tools whenever you can take action. Keep any spoken reply brief.";
const TOOL_INPUT_RECOVERY_PROMPT =
  "The previous tool call used invalid JSON arguments. Retry the same action with valid JSON that matches the tool schema. Keep the spoken reply brief.";
const TOOL_INPUT_RECOVERY_COOLDOWN_MS = 2500;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function createAbortError() {
  const error = new Error("Voice control connection was cancelled.") as Error & {
    code?: VoiceControlErrorCode;
  };
  error.name = "AbortError";
  error.code = "aborted";
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (error as Error & { code?: string }).code === "aborted")
  );
}

async function withAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
  onResolvedAfterAbort?: (value: T) => void,
) {
  throwIfAborted(signal);

  if (!signal) {
    return promise;
  }

  return await new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal.removeEventListener("abort", handleAbort);
    };

    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      callback();
    };

    const handleAbort = () => {
      settle(() => {
        reject(createAbortError());
      });
    };

    signal.addEventListener("abort", handleAbort, { once: true });

    void promise.then(
      (value) => {
        if (signal.aborted) {
          onResolvedAfterAbort?.(value);
          settle(() => {
            reject(createAbortError());
          });
          return;
        }

        settle(() => {
          resolve(value);
        });
      },
      (error) => {
        settle(() => {
          reject(error);
        });
      },
    );
  });
}

function stripSchemaMetadata(schema: JsonSchema): JsonSchema {
  const { $schema, definitions, $ref, ...rest } = schema;

  if (typeof $ref === "string" && definitions && typeof definitions === "object") {
    const key = $ref.split("/").at(-1);
    const definitionMap = definitions as Record<string, unknown>;
    if (key && key in definitionMap) {
      return stripSchemaMetadata(definitionMap[key] as JsonSchema);
    }
  }

  return rest;
}

export function defineVoiceTool<TArgs>(definition: VoiceToolDefinition<TArgs>): VoiceTool<TArgs> {
  const jsonSchema = stripSchemaMetadata(toJSONSchema(definition.parameters) as JsonSchema);

  return {
    ...definition,
    jsonSchema,
    realtimeTool: {
      type: "function",
      name: definition.name,
      description: definition.description,
      parameters: jsonSchema,
    },
    parseArguments(rawArgs: string) {
      const parsed = rawArgs.trim().length === 0 ? {} : JSON.parse(rawArgs);
      return definition.parameters.parse(parsed);
    },
  };
}

function outputModalitiesForMode(outputMode: OutputMode): Array<"text" | "audio"> {
  switch (outputMode) {
    case "audio":
      return ["audio"];
    case "text+audio":
      return ["text", "audio"];
    case "tool-only":
    case "text":
    default:
      return ["text"];
  }
}

function defaultTurnDetection(
  session: VoiceControlResolvedSessionConfig,
): RealtimeTurnDetection | null {
  if (session.activationMode !== "vad") {
    return null;
  }

  return {
    type: "server_vad",
    createResponse: true,
    interruptResponse: true,
    prefixPaddingMs: 300,
    silenceDurationMs: 200,
    threshold: 0.5,
  };
}

function buildAudioConfig(session: VoiceControlResolvedSessionConfig) {
  const input = session.audio?.input;
  const output = session.audio?.output;
  const turnDetection =
    session.activationMode === "vad"
      ? (input?.turnDetection ?? defaultTurnDetection(session))
      : null;

  const inputConfig =
    input || turnDetection !== null
      ? {
          ...(input?.format !== undefined ? { format: input.format } : {}),
          ...(turnDetection !== null ? { turnDetection } : {}),
        }
      : undefined;

  const outputConfig = output
    ? {
        ...(output.format !== undefined ? { format: output.format } : {}),
        ...(output.speed !== undefined ? { speed: output.speed } : {}),
        ...(output.voice !== undefined ? { voice: output.voice } : {}),
      }
    : undefined;

  if (!inputConfig && !outputConfig) {
    return undefined;
  }

  return {
    ...(inputConfig ? { input: inputConfig } : {}),
    ...(outputConfig ? { output: outputConfig } : {}),
  };
}

function buildRealtimeSessionConfig(session: VoiceControlResolvedSessionConfig) {
  const audio = buildAudioConfig(session);

  return {
    outputModalities: outputModalitiesForMode(session.outputMode),
    ...(audio ? { audio } : {}),
  } satisfies Partial<RealtimeSessionConfig>;
}

function buildResponseCreateConfig(session: VoiceControlResolvedSessionConfig) {
  if (session.maxOutputTokens === undefined) {
    return undefined;
  }

  return {
    max_output_tokens: session.maxOutputTokens,
  };
}

async function fetchClientSecret(
  auth: UseVoiceControlOptions["auth"],
  model: string,
  signal?: AbortSignal,
) {
  const headers = new Headers(auth.sessionRequestInit?.headers);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");

  const response = await fetch(new URL(auth.sessionEndpoint, window.location.origin), {
    ...auth.sessionRequestInit,
    method: "POST",
    headers,
    body: JSON.stringify({ model }),
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const rawError = await withAbort(response.text(), signal);

    if (rawError) {
      let message = rawError;

      try {
        const payload = JSON.parse(rawError) as {
          error?: unknown;
          message?: unknown;
        };
        message =
          typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : rawError;
      } catch {
        message = rawError;
      }

      throw new Error(message);
    }

    throw new Error("Failed to create a Realtime client secret.");
  }

  const payload = (await withAbort(response.json(), signal)) as
    | { clientSecret?: unknown; value?: unknown }
    | null;

  const clientSecret =
    typeof payload?.clientSecret === "string"
      ? payload.clientSecret
      : typeof payload?.value === "string"
        ? payload.value
        : null;

  if (!clientSecret) {
    throw new Error("Realtime client secret response did not include a clientSecret.");
  }

  return clientSecret;
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function extractObjectMessage(error: Record<string, unknown>): string | null {
  const directMessage =
    readStringField(error, "message") ??
    readStringField(error, "error") ??
    readStringField(error, "reason") ??
    readStringField(error, "statusText");

  if (directMessage) {
    return directMessage;
  }

  const nestedError = error.error;
  if (nestedError && typeof nestedError === "object") {
    const nestedMessage: string | null = extractObjectMessage(
      nestedError as Record<string, unknown>,
    );
    if (nestedMessage) {
      return nestedMessage;
    }
  }

  return null;
}

function describeBrowserEvent(error: Event) {
  const target = error.target;

  if (target instanceof RTCDataChannel) {
    return "Realtime voice connection failed while opening the WebRTC data channel.";
  }

  if (target instanceof RTCPeerConnection) {
    return `Realtime voice connection failed during WebRTC negotiation (${target.connectionState}).`;
  }

  if (target instanceof MediaStreamTrack) {
    return `Realtime voice connection failed while accessing the microphone (${target.readyState}).`;
  }

  if (error.type) {
    return `Realtime voice connection failed with browser event: ${error.type}.`;
  }

  return null;
}

async function readRealtimeCallError(response: Response) {
  const rawBody = await response.text();
  if (!rawBody) {
    return `OpenAI Realtime call failed (${response.status}).`;
  }

  try {
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return (
      extractObjectMessage(parsed) ??
      `OpenAI Realtime call failed (${response.status}).`
    );
  } catch {
    return rawBody;
  }
}

async function connectRealtimeSession(
  session: RealtimeSession<unknown>,
  options: {
    apiKey: string;
    model: string;
  },
) {
  const originalFetch = globalThis.fetch;
  const wrappedFetch: typeof fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (
      requestUrl.startsWith("https://api.openai.com/v1/realtime/calls") &&
      !response.ok
    ) {
      throw new Error(await readRealtimeCallError(response.clone()));
    }

    return response;
  };

  globalThis.fetch = wrappedFetch;

  try {
    await session.connect(options);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function normalizeError(error: unknown): VoiceControlError {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: VoiceControlErrorCode };

    let code: VoiceControlErrorCode = errorWithCode.code ?? "unknown";
    const message = error.message.toLowerCase();

    if (error.name === "AbortError") {
      code = "aborted";
    } else if (
      error.name === "InvalidToolInputError" ||
      message.includes("invalid json input for tool") ||
      message.includes("while parsing tool arguments") ||
      message.includes("after property name in json") ||
      message.includes("unterminated string in json") ||
      message.includes("unexpected end of json input") ||
      message.includes("unexpected non-whitespace character after json") ||
      (message.includes("unexpected token") && message.includes("json"))
    ) {
      code = "invalid_tool_input";
    } else if (
      message.includes("conversation already has an active response") ||
      message.includes("active response in progress")
    ) {
      code = "active_response";
    } else if (error.name === "NotAllowedError") {
      code = message.includes("secure context") ? "insecure_context" : "permission_denied";
    } else if (
      error.name === "NotFoundError" ||
      error.name === "NotReadableError" ||
      error.name === "OverconstrainedError"
    ) {
      code = "device_unavailable";
    } else if (error.name === "NotSupportedError") {
      code = "unsupported_browser";
    } else if (
      message.includes("client secret") ||
      message.includes("realtime") ||
      message.includes("network")
    ) {
      code = "network_error";
    }

    return {
      code,
      message: error.message,
      cause: error,
    };
  }

  if (typeof ErrorEvent !== "undefined" && error instanceof ErrorEvent) {
    const message = error.message || (error.error instanceof Error ? error.error.message : "");
    return {
      code: "unknown",
      message: message || "Realtime voice connection failed.",
      cause: error,
    };
  }

  if (typeof Event !== "undefined" && error instanceof Event) {
    return {
      code: "network_error",
      message: describeBrowserEvent(error) ?? "Realtime voice connection failed.",
      cause: error,
    };
  }

  if (typeof error === "string") {
    const message = error.toLowerCase();
    return {
      code:
        message.includes("conversation already has an active response") ||
        message.includes("active response in progress")
          ? "active_response"
          : "unknown",
      message: error,
    };
  }

  if (error && typeof error === "object") {
    const message = extractObjectMessage(error as Record<string, unknown>);
    if (message) {
      return {
        code: "unknown",
        message,
        cause: error,
      };
    }
  }

  return {
    code: "unknown",
    message: "Unknown voice control error.",
    cause: error,
  };
}

function extractTextDelta(event: RealtimeServerEvent) {
  if (
    event.type === "response.text.delta" ||
    event.type === "response.output_text.delta" ||
    event.type === "response.output_audio_transcript.delta"
  ) {
    return typeof event.delta === "string" ? event.delta : null;
  }

  return null;
}

function extractCompletedText(event: RealtimeServerEvent) {
  if (event.type === "response.output_text.done") {
    return typeof event.text === "string" ? event.text : null;
  }

  if (event.type === "response.output_audio_transcript.done") {
    return typeof event.transcript === "string" ? event.transcript : null;
  }

  return null;
}

function readStatusText(
  statusDetails: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = statusDetails?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractResponseStopReason(statusDetails: unknown) {
  if (!statusDetails || typeof statusDetails !== "object") {
    return null;
  }

  const details = statusDetails as Record<string, unknown>;

  return (
    readStatusText(details, "reason") ??
    readStatusText(details, "status") ??
    readStatusText(details, "type")
  );
}

function extractResponseError(statusDetails: unknown) {
  if (!statusDetails || typeof statusDetails !== "object") {
    return null;
  }

  return extractObjectMessage(statusDetails as Record<string, unknown>);
}

function extractFinalMessageText(outputItems: unknown[]) {
  for (let index = outputItems.length - 1; index >= 0; index -= 1) {
    const item = outputItems[index];
    if (!item || typeof item !== "object") {
      continue;
    }

    const messageItem = item as {
      type?: string;
      content?: Array<{
        type?: string;
        text?: string | null;
        transcript?: string | null;
      }>;
    };

    if (messageItem.type !== "message" || !Array.isArray(messageItem.content)) {
      continue;
    }

    for (let contentIndex = messageItem.content.length - 1; contentIndex >= 0; contentIndex -= 1) {
      const contentPart = messageItem.content[contentIndex];
      if (typeof contentPart?.transcript === "string" && contentPart.transcript.trim()) {
        return contentPart.transcript;
      }

      if (typeof contentPart?.text === "string" && contentPart.text.trim()) {
        return contentPart.text;
      }
    }
  }

  return null;
}

function resolveSessionConfig(
  options: UseVoiceControlOptions,
  instructions: string,
  tools: VoiceTool[],
): VoiceControlResolvedSessionConfig {
  return {
    model: options.model ?? DEFAULT_MODEL,
    instructions,
    tools: tools.map((tool) => tool.realtimeTool),
    activationMode: options.activationMode ?? "vad",
    outputMode: options.outputMode ?? "audio",
    ...(options.audio !== undefined ? { audio: options.audio } : {}),
    ...(options.maxOutputTokens !== undefined
      ? { maxOutputTokens: options.maxOutputTokens }
      : {}),
  };
}

function deriveStatus(activity: VoiceControlActivity, connected: boolean): VoiceControlStatus {
  if (activity === "connecting") {
    return "connecting";
  }

  if (activity === "error") {
    return "error";
  }

  if (!connected) {
    return "idle";
  }

  if (activity === "processing" || activity === "executing") {
    return "processing";
  }

  return "listening";
}

function createInitialSnapshot(options: UseVoiceControlOptions): VoiceControlSnapshot {
  const sessionConfig = resolveSessionConfig(
    options,
    options.instructions ?? DEFAULT_INSTRUCTIONS,
    options.tools,
  );

  return {
    status: "idle",
    activity: "idle",
    connected: false,
    muted: false,
    transcript: "",
    toolCalls: [],
    latestToolCall: null,
    sessionConfig,
  };
}

function getToolCallId(toolName: string, details?: unknown) {
  const toolCall = (details as { toolCall?: { callId?: string; id?: string } } | undefined)
    ?.toolCall;
  return (
    toolCall?.callId ??
    toolCall?.id ??
    `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
}

type PendingVoiceGeneration = {
  conversationId?: string | null;
  inputText: string;
  responseId?: string | null;
  startedAt: number;
  timeToFirstTokenAt?: number;
};

class VoiceControlControllerImpl implements VoiceControlController {
  private connectAttempt = 0;
  private destroyed = false;
  private lastInputTranscript: string | null = null;
  private lastRecoverableToolInputAt = 0;
  private listeners = new Set<() => void>();
  private liveInstructions: string;
  private liveTools: VoiceTool[];
  private nextToolCallSequence = 1;
  private options: UseVoiceControlOptions;
  private pendingGeneration: PendingVoiceGeneration | null = null;
  private responseInFlight = false;
  private runningToolCallCount = 0;
  private session: RealtimeSession<unknown> | null = null;
  private sessionAbortController: AbortController | null = null;
  private sessionDisposers: Array<() => void> = [];
  private snapshot: VoiceControlSnapshot;
  private toolCallOrder: string[] = [];
  private toolCallRecords = new Map<string, VoiceToolCallRecord>();

  constructor(options: UseVoiceControlOptions) {
    this.options = options;
    this.snapshot = createInitialSnapshot(options);
    this.liveInstructions = this.snapshot.sessionConfig.instructions;
    this.liveTools = options.tools;
  }

  get status() {
    return this.snapshot.status;
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

  get transcript() {
    return this.snapshot.transcript;
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

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  configure = (options: UseVoiceControlOptions) => {
    if (this.destroyed) {
      return;
    }

    this.options = options;
    this.liveInstructions = options.instructions ?? DEFAULT_INSTRUCTIONS;
    this.liveTools = options.tools;

    const nextSessionConfig = resolveSessionConfig(options, this.liveInstructions, this.liveTools);
    this.setSessionConfig(nextSessionConfig);

    if (this.connected) {
      void this.applyConnectedSessionUpdate(nextSessionConfig);
    }
  };

  destroy = () => {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.connectAttempt += 1;
    this.sessionAbortController?.abort();
    this.sessionAbortController = null;
    this.cleanupSession();
    this.listeners.clear();
  };

  connect = async () => {
    if (this.destroyed || this.connected || this.activity === "connecting") {
      return;
    }

    const attemptId = ++this.connectAttempt;
    this.sessionAbortController?.abort();
    this.sessionAbortController = new AbortController();
    const connectSignal = this.sessionAbortController.signal;

    this.setActivity("connecting");
    this.lastInputTranscript = null;
    this.setTranscript("");
    this.clearToolCalls();
    this.resetResponseState();

    const session = this.createSession();
    this.attachSession(session);

    try {
      const clientSecret = await fetchClientSecret(
        this.options.auth,
        this.sessionConfig.model,
        connectSignal,
      );

      throwIfAborted(connectSignal);
      await connectRealtimeSession(session, {
        apiKey: clientSecret,
        model: this.sessionConfig.model,
      });

      if (this.destroyed || attemptId !== this.connectAttempt || this.session !== session) {
        session.close();
        return;
      }

      this.sessionAbortController = null;
      this.setConnected(true);
      this.setMutedState(Boolean(session.muted));
      this.setActivity(this.runningToolCallCount > 0 ? "executing" : "listening");
    } catch (error) {
      if (this.sessionAbortController?.signal === connectSignal) {
        this.sessionAbortController = null;
      }

      if (this.destroyed || attemptId !== this.connectAttempt || isAbortError(error)) {
        this.cleanupSession();
        this.setConnected(false);
        this.setMutedState(false);
        this.setActivity("idle");
        return;
      }

      this.emitError(error, true);
    }
  };

  disconnect = () => {
    if (this.destroyed) {
      return;
    }

    this.connectAttempt += 1;
    this.sessionAbortController?.abort();
    this.sessionAbortController = null;
    this.cleanupSession();
    this.setConnected(false);
    this.setMutedState(false);
    this.setActivity("idle");
    this.lastInputTranscript = null;
    this.setTranscript("");
    this.resetResponseState();
  };

  setMuted = (muted: boolean) => {
    if (this.destroyed) {
      return;
    }

    const session = this.session;
    if (!session || !this.connected) {
      return;
    }

    try {
      session.mute(muted);
      this.setMutedState(muted);
    } catch (error) {
      this.emitError(error, false);
    }
  };

  requestResponse = () => {
    if (this.destroyed || !this.connected || !this.session) {
      return;
    }

    if (this.responseInFlight) {
      return;
    }

    const response = buildResponseCreateConfig(this.sessionConfig);
    this.responseInFlight = true;
    this.setActivity(this.runningToolCallCount > 0 ? "executing" : "processing");

    if (this.session.transport.requestResponse) {
      this.session.transport.requestResponse(response);
      return;
    }

    this.session.transport.sendEvent({
      type: "response.create",
      ...(response ? { response } : {}),
    });
  };

  sendClientEvent = (event: RealtimeClientEvent) => {
    if (this.destroyed || !this.session) {
      return;
    }

    this.session.transport.sendEvent(event as never);
  };

  getPeerConnection = () => {
    const transport = this.session?.transport;
    if (!(transport instanceof OpenAIRealtimeWebRTC)) {
      return null;
    }

    return transport.connectionState.peerConnection ?? null;
  };

  private createSession() {
    return new RealtimeSession(this.createSessionAgent(), {
      model: this.sessionConfig.model,
      transport: "webrtc",
      config: buildRealtimeSessionConfig(this.sessionConfig),
    });
  }

  private createSessionAgent() {
    return new RealtimeAgent({
      name: "ExamCooker Voice Guide",
      instructions: this.liveInstructions,
      ...(this.sessionConfig.audio?.output?.voice
        ? { voice: this.sessionConfig.audio.output.voice }
        : {}),
      tools: this.liveTools.map((voiceTool) => this.createSdkTool(voiceTool)),
    });
  }

  private createSdkTool<TArgs>(voiceTool: VoiceTool<TArgs>) {
    return createRealtimeTool({
      name: voiceTool.name,
      description: voiceTool.description,
      parameters: voiceTool.jsonSchema as never,
      strict: false,
      execute: async (input, _context, details) => {
        const callId = getToolCallId(voiceTool.name, details);
        const startedAt = Date.now();

        this.runningToolCallCount += 1;
        this.setActivity("executing");
        this.upsertToolCallRecord({
          args: input,
          id: callId,
          name: voiceTool.name,
          startedAt,
          status: "running",
        });

        try {
          const output = await voiceTool.execute(input as TArgs);
          this.upsertToolCallRecord({
            args: input,
            finishedAt: Date.now(),
            id: callId,
            name: voiceTool.name,
            output,
            startedAt,
            status: "success",
          });
          return output;
        } catch (error) {
          this.upsertToolCallRecord({
            args: input,
            error: normalizeError(error),
            finishedAt: Date.now(),
            id: callId,
            name: voiceTool.name,
            startedAt,
            status: "error",
          });
          throw error;
        } finally {
          this.runningToolCallCount = Math.max(0, this.runningToolCallCount - 1);

          if (this.runningToolCallCount > 0) {
            this.setActivity("executing");
          } else if (this.responseInFlight) {
            this.setActivity("processing");
          } else {
            this.setActivity(this.restingActivity());
          }
        }
      },
      errorFunction: (_context, error) => normalizeError(error).message,
    });
  }

  private attachSession(session: RealtimeSession<unknown>) {
    this.cleanupSession();
    this.session = session;

    const bind = (
      emitter: {
        on: (event: string, handler: (...args: any[]) => void) => void;
        off?: (event: string, handler: (...args: any[]) => void) => void;
      },
      event: string,
      handler: (...args: any[]) => void,
    ) => {
      emitter.on(event, handler);
      this.sessionDisposers.push(() => {
        emitter.off?.(event, handler);
      });
    };

    bind(session, "error", (event: { error?: unknown }) => {
      if (this.session !== session) {
        return;
      }

      this.emitError(event.error ?? "Realtime session error.", session.transport.status === "disconnected");
    });

    bind(session, "transport_event", (event: RealtimeServerEvent) => {
      if (this.session !== session) {
        return;
      }

      this.handleTransportEvent(event);
    });

    bind(session.transport, "connection_change", (status: string) => {
      if (this.session !== session) {
        return;
      }

      if (status === "connecting") {
        this.setConnected(false);
        this.setMutedState(false);
        this.setActivity("connecting");
        return;
      }

      if (status === "connected") {
        this.setConnected(true);
        this.setMutedState(Boolean(session.muted));
        if (this.runningToolCallCount === 0 && !this.responseInFlight) {
          this.setActivity("listening");
        }
        return;
      }

      if (status === "disconnected") {
        this.session = null;
        this.clearSessionDisposers();
        this.resetResponseState();
        this.setConnected(false);
        this.setMutedState(false);
        this.setActivity("idle");
      }
    });
  }

  private clearSessionDisposers() {
    const disposers = this.sessionDisposers;
    this.sessionDisposers = [];

    for (const dispose of disposers) {
      dispose();
    }
  }

  private cleanupSession() {
    const session = this.session;
    this.session = null;
    this.clearSessionDisposers();
    session?.close();
  }

  private syncConnectedStateFromTransport(event?: RealtimeServerEvent) {
    const session = this.session;
    if (!session) {
      return;
    }

    const hasLiveTransport =
      session.transport.status === "connected" ||
      (event !== undefined && event.type !== "error");

    if (!hasLiveTransport) {
      return;
    }

    if (!this.connected) {
      this.setConnected(true);
    }

    this.setMutedState(Boolean(session.muted));

    if (this.activity === "connecting") {
      if (this.runningToolCallCount > 0) {
        this.setActivity("executing");
      } else if (this.responseInFlight) {
        this.setActivity("processing");
      } else {
        this.setActivity("listening");
      }
    }
  }

  private async applyConnectedSessionUpdate(nextSessionConfig: VoiceControlResolvedSessionConfig) {
    const session = this.session;
    if (!session) {
      return;
    }

    const mutableSession = session as MutableRealtimeSession;
    mutableSession.options = {
      ...mutableSession.options,
      model: nextSessionConfig.model,
      config: buildRealtimeSessionConfig(nextSessionConfig),
    };

    try {
      await session.updateAgent(this.createSessionAgent());
    } catch (error) {
      if (this.session !== session) {
        return;
      }

      this.emitError(error, false);
    }
  }

  private handleTransportEvent(event: RealtimeServerEvent) {
    this.syncConnectedStateFromTransport(event);

    if (event.type === "conversation.item.input_audio_transcription.completed") {
      const transcript =
        typeof event.transcript === "string" ? event.transcript.trim() : "";

      if (transcript) {
        this.lastInputTranscript = transcript;
      }
    }

    if (event.type === "response.created") {
      const response = event.response as
        | {
            conversation_id?: string | null;
            id?: string | null;
          }
        | undefined;

      this.pendingGeneration = {
        conversationId:
          typeof response?.conversation_id === "string"
            ? response.conversation_id
            : null,
        inputText: this.lastInputTranscript ?? "",
        responseId: typeof response?.id === "string" ? response.id : null,
        startedAt: Date.now(),
      };
      this.responseInFlight = true;
      this.setTranscript("");
      if (this.runningToolCallCount === 0) {
        this.setActivity("processing");
      }
    }

    const textDelta = extractTextDelta(event);
    if (textDelta) {
      if (
        this.pendingGeneration &&
        this.pendingGeneration.timeToFirstTokenAt === undefined
      ) {
        this.pendingGeneration.timeToFirstTokenAt = Date.now();
      }
      this.setTranscript(`${this.transcript}${textDelta}`);
    }

    const completedText = extractCompletedText(event);
    if (completedText) {
      if (
        this.pendingGeneration &&
        this.pendingGeneration.timeToFirstTokenAt === undefined
      ) {
        this.pendingGeneration.timeToFirstTokenAt = Date.now();
      }
      this.setTranscript(completedText);
    }

    if (event.type === "response.done") {
      this.responseInFlight = false;
      const response = event.response as
        | {
            conversation_id?: string | null;
            id?: string | null;
            output?: unknown[];
            status?: string | null;
            status_details?: Record<string, unknown> | null;
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
            } | null;
          }
        | undefined;
      const finalText = Array.isArray(response?.output)
        ? extractFinalMessageText(response.output)
        : null;
      const pendingGeneration = this.pendingGeneration;

      this.pendingGeneration = null;

      if (finalText) {
        this.setTranscript(finalText);
      }

      if (pendingGeneration?.inputText.trim()) {
        const status =
          typeof response?.status === "string" && response.status.trim()
            ? response.status
            : "completed";

        this.options.onGenerationCompleted?.({
          conversationId:
            typeof response?.conversation_id === "string"
              ? response.conversation_id
              : pendingGeneration.conversationId ?? null,
          errorMessage: extractResponseError(response?.status_details) ?? undefined,
          inputText: pendingGeneration.inputText,
          inputTokens:
            typeof response?.usage?.input_tokens === "number"
              ? response.usage.input_tokens
              : undefined,
          latencyMs: Math.max(Date.now() - pendingGeneration.startedAt, 0),
          model: this.sessionConfig.model,
          outputText: finalText,
          outputTokens:
            typeof response?.usage?.output_tokens === "number"
              ? response.usage.output_tokens
              : undefined,
          responseId:
            typeof response?.id === "string"
              ? response.id
              : pendingGeneration.responseId ?? null,
          status,
          stopReason: extractResponseStopReason(response?.status_details) ?? undefined,
          timeToFirstTokenMs:
            pendingGeneration.timeToFirstTokenAt !== undefined
              ? Math.max(
                  pendingGeneration.timeToFirstTokenAt -
                    pendingGeneration.startedAt,
                  0,
                )
              : undefined,
        });
      }

      if (this.runningToolCallCount === 0) {
        this.setActivity(this.restingActivity());
      }
    }

    if (event.type === "error") {
      const details = event.error as { message?: string } | undefined;
      this.emitError(details?.message ?? "Realtime server error.", false);
    }
  }

  private notify() {
    if (this.destroyed) {
      return;
    }

    for (const listener of this.listeners) {
      listener();
    }
  }

  private publish(partial: Partial<Omit<VoiceControlSnapshot, "latestToolCall" | "status">> = {}) {
    const nextActivity = partial.activity ?? this.snapshot.activity;
    const nextConnected = partial.connected ?? this.snapshot.connected;
    const nextMuted = partial.muted ?? this.snapshot.muted;
    const nextTranscript = partial.transcript ?? this.snapshot.transcript;
    const nextToolCalls = partial.toolCalls ?? this.snapshot.toolCalls;
    const nextSessionConfig = partial.sessionConfig ?? this.snapshot.sessionConfig;
    const nextStatus = deriveStatus(nextActivity, nextConnected);
    const nextLatestToolCall = nextToolCalls.at(-1) ?? null;

    if (
      this.snapshot.activity === nextActivity &&
      this.snapshot.connected === nextConnected &&
      this.snapshot.muted === nextMuted &&
      this.snapshot.transcript === nextTranscript &&
      this.snapshot.toolCalls === nextToolCalls &&
      this.snapshot.sessionConfig === nextSessionConfig &&
      this.snapshot.status === nextStatus &&
      this.snapshot.latestToolCall === nextLatestToolCall
    ) {
      return;
    }

    this.snapshot = {
      activity: nextActivity,
      connected: nextConnected,
      latestToolCall: nextLatestToolCall,
      muted: nextMuted,
      sessionConfig: nextSessionConfig,
      status: nextStatus,
      toolCalls: nextToolCalls,
      transcript: nextTranscript,
    };
    this.notify();
  }

  private setActivity(next: VoiceControlActivity) {
    this.publish({ activity: next });
  }

  private setConnected(next: boolean) {
    this.publish({ connected: next });
  }

  private setMutedState(next: boolean) {
    this.publish({ muted: next });
  }

  private setTranscript(next: string) {
    this.publish({ transcript: next });
  }

  private setSessionConfig(next: VoiceControlResolvedSessionConfig) {
    this.publish({ sessionConfig: next });
  }

  private clearToolCalls() {
    this.toolCallRecords.clear();
    this.toolCallOrder = [];
    this.nextToolCallSequence = 1;
    this.publish({ toolCalls: [] });
  }

  private resetResponseState() {
    this.pendingGeneration = null;
    this.responseInFlight = false;
    this.runningToolCallCount = 0;
  }

  private restingActivity() {
    return this.connected ? "listening" : "idle";
  }

  private recoverFromInvalidToolInput() {
    this.resetResponseState();
    this.setActivity(this.restingActivity());

    if (!this.connected || !this.session) {
      return;
    }

    const now = Date.now();
    if (now - this.lastRecoverableToolInputAt < TOOL_INPUT_RECOVERY_COOLDOWN_MS) {
      return;
    }

    this.lastRecoverableToolInputAt = now;
    this.sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text: TOOL_INPUT_RECOVERY_PROMPT,
          },
        ],
      },
    });
    this.requestResponse();
  }

  private emitError(error: unknown, disconnect: boolean) {
    const normalized = normalizeError(error);

    if (!disconnect && normalized.code === "active_response") {
      this.setActivity(this.responseInFlight ? "processing" : this.restingActivity());
      return;
    }

    if (!disconnect && normalized.code === "invalid_tool_input") {
      this.recoverFromInvalidToolInput();
      return;
    }

    if (disconnect) {
      this.cleanupSession();
      this.setConnected(false);
      this.setMutedState(false);
    }

    this.resetResponseState();
    this.setActivity("error");
    this.options.onError?.(normalized);
  }

  private syncToolCallSnapshot() {
    this.publish({
      toolCalls: this.toolCallOrder
        .map((id) => this.toolCallRecords.get(id))
        .filter((record): record is VoiceToolCallRecord => record !== undefined),
    });
  }

  private upsertToolCallRecord(record: {
    args?: unknown;
    error?: VoiceControlError;
    finishedAt?: number;
    id: string;
    name: string;
    output?: unknown;
    startedAt: number;
    status: ToolCallStatus;
  }) {
    const existing = this.toolCallRecords.get(record.id);
    const nextFinishedAt = record.finishedAt ?? existing?.finishedAt;

    const next: VoiceToolCallRecord = {
      id: record.id,
      sequence: existing?.sequence ?? this.nextToolCallSequence++,
      name: record.name,
      status: record.status,
      ...(record.args !== undefined
        ? { args: record.args }
        : existing?.args !== undefined
          ? { args: existing.args }
          : {}),
      ...(record.output !== undefined ? { output: record.output } : {}),
      ...(record.error !== undefined ? { error: record.error } : {}),
      startedAt: existing?.startedAt ?? record.startedAt,
      ...(nextFinishedAt !== undefined
        ? {
            finishedAt: nextFinishedAt,
            durationMs: Math.max(0, nextFinishedAt - (existing?.startedAt ?? record.startedAt)),
          }
        : {}),
    };

    if (!existing) {
      this.toolCallOrder = [...this.toolCallOrder, record.id];
    }

    this.toolCallRecords.set(record.id, next);
    this.syncToolCallSnapshot();
  }
}

export function createVoiceControlController(
  options: UseVoiceControlOptions,
): VoiceControlController {
  return new VoiceControlControllerImpl(options);
}

export function useVoiceControl(controller: VoiceControlController): UseVoiceControlReturn {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return controller;
}

function getViewportFallbackPoint() {
  if (typeof window === "undefined") {
    return {
      x: 0,
      y: 0,
    };
  }

  return {
    x: Math.max(window.innerWidth - 84, 0),
    y: Math.max(window.innerHeight - 84, 0),
  };
}

function getElementPoint(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const isTextEntry = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

  if (isTextEntry) {
    return {
      x: rect.left + Math.min(28, rect.width * 0.18),
      y: rect.top + rect.height / 2,
    };
  }

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function resolveTargetPoint(target: GhostCursorTarget) {
  if (target.point) {
    return target.point;
  }

  if (target.element) {
    return getElementPoint(target.element);
  }

  return getViewportFallbackPoint();
}

export function useGhostCursor(): UseGhostCursorReturn {
  const [cursorState, setCursorState] = useState<GhostCursorState>(() => ({
    visible: false,
    phase: "hidden",
    ...getViewportFallbackPoint(),
  }));
  const scriptedPointerRef = useRef<{ x: number; y: number } | null>(null);
  const queueRef = useRef(Promise.resolve());

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (scriptedPointerRef.current) {
        return;
      }

      setCursorState((current) =>
        current.visible
          ? current
          : {
              ...current,
              x: event.clientX,
              y: event.clientY,
            },
      );
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  const hide = useCallback(() => {
    scriptedPointerRef.current = null;
    setCursorState((current) => ({
      ...current,
      visible: false,
      phase: "hidden",
    }));
  }, []);

  const run = useCallback<UseGhostCursorReturn["run"]>(
    async (target, operation) => {
      const nextTask = queueRef.current.then(async () => {
        const targetElement = target.element ?? null;
        if (targetElement) {
          targetElement.scrollIntoView({
            block: "center",
            inline: "center",
            behavior: "smooth",
          });
          await wait(180);
        }

        const point = resolveTargetPoint(target);
        scriptedPointerRef.current = point;
        setCursorState({
          phase: "traveling",
          visible: true,
          x: point.x,
          y: point.y,
        });

        await wait(220);
        setCursorState((current) => ({
          ...current,
          phase: "arrived",
        }));
        try {
          const result = await operation();
          await wait(180);
          return result;
        } finally {
          scriptedPointerRef.current = null;
          setCursorState((current) => ({
            ...current,
            visible: false,
            phase: "hidden",
          }));
        }
      });

      queueRef.current = nextTask.then(
        () => undefined,
        () => undefined,
      );
      return await nextTask;
    },
    [],
  );

  return {
    cursorState,
    hide,
    run,
  };
}

export function GhostCursorOverlay({ state }: { state: GhostCursorState }) {
  if (!state.visible || state.phase === "hidden") {
    return null;
  }

  const style = {
    left: 0,
    pointerEvents: "none",
    position: "fixed",
    top: 0,
    transform: `translate3d(${state.x}px, ${state.y}px, 0)`,
    transition:
      state.phase === "traveling"
        ? "transform 220ms cubic-bezier(0.22, 0.84, 0.26, 1)"
        : "transform 140ms ease-out, opacity 180ms ease-out",
    zIndex: 80,
  } satisfies CSSProperties;

  return (
    <div aria-hidden="true" style={style}>
      <span
        style={{
          position: "absolute",
          left: -18,
          top: -18,
          width: 36,
          height: 36,
          borderRadius: 9999,
          background:
            state.phase === "traveling"
              ? "radial-gradient(circle, rgba(59,244,199,0.28), rgba(59,244,199,0.02))"
              : "radial-gradient(circle, rgba(77,179,214,0.28), rgba(77,179,214,0.03))",
          transform: state.phase === "arrived" ? "scale(1.15)" : "scale(1)",
          transition: "transform 180ms ease-out",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: -7,
          top: -7,
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: "#ffffff",
          border: "3px solid #3BF4C7",
          boxShadow: "0 8px 22px rgba(0,0,0,0.16)",
        }}
      />
    </div>
  );
}
