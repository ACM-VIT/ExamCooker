import type { RealtimeOutputGuardrail } from "@openai/agents/realtime";
import type { ZodType } from "zod";

export type JsonSchema = {
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

export type RealtimeServerEvent = {
  type: string;
  [key: string]: unknown;
};

export type RealtimeClientEvent = {
  type: string;
  [key: string]: unknown;
};

export type RealtimeUserInput =
  | string
  | {
      type: "message";
      role: "user";
      content: Array<
        | {
            type: "input_text";
            text: string;
          }
        | {
            type: "input_image";
            image: string;
            providerData?: Record<string, unknown>;
          }
      >;
    };

export type ToolCallStatus = "running" | "success" | "error" | "skipped";

export type VoiceControlErrorCode =
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
      idleTimeoutMs?: number;
      modelVersion?: string;
    };

export type RealtimeAudioConfig = {
  input?: {
    format?: RealtimeAudioFormat;
    capture?: MediaTrackConstraints;
    noiseReduction?: {
      type: "near_field" | "far_field" | (string & {});
    } | null;
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

export type RealtimeFunctionTool = {
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

export type VoiceControlResolvedSessionConfig = {
  model: string;
  instructions: string;
  tools: RealtimeFunctionTool[];
  activationMode: ActivationMode;
  outputMode: OutputMode;
  audio?: RealtimeAudioConfig;
  maxOutputTokens?: number | "inf";
};

export type VoiceControlTraceConfig = {
  workflowName?: string;
  groupId?: string;
  metadata?: Record<string, unknown>;
  disabled?: boolean;
};

export type VoiceControlTraceOptions =
  | VoiceControlTraceConfig
  | (() => VoiceControlTraceConfig | null | undefined);

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
  outputGuardrails?: RealtimeOutputGuardrail[];
  postToolResponse?: boolean;
  debug?: boolean;
  trace?: VoiceControlTraceOptions;
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

export type VoiceControlSnapshot = {
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
  interrupt: () => void;
  addImage: (
    image: string,
    options?: {
      triggerResponse?: boolean;
    },
  ) => void;
  requestResponse: () => void;
  sendContextMessage: (text: string) => void;
  sendClientEvent: (event: RealtimeClientEvent) => void;
  sendMessage: (
    message: RealtimeUserInput,
    otherEventData?: Record<string, unknown>,
  ) => void;
};

export type VoiceControlController = UseVoiceControlReturn & {
  configure: (options: UseVoiceControlOptions) => void;
  destroy: () => void;
  getPeerConnection: () => RTCPeerConnection | null;
  getSnapshot: () => VoiceControlSnapshot;
  subscribe: (listener: () => void) => () => void;
};
