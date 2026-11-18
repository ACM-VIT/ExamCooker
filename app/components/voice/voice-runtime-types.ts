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

export type ToolCallStatus = "running" | "success" | "error" | "skipped";

export type VoiceControlErrorCode =
  | "aborted"
  | "device_unavailable"
  | "insecure_context"
  | "network_error"
  | "permission_denied"
  | "unsupported_browser";

export type VoiceControlError = {
  code?: VoiceControlErrorCode;
  message: string;
  cause?: unknown;
};

// One lifecycle for the whole session. `connected` in the snapshot is derived
// from it: listening, processing and executing are the live activities.
// `closing` means session.close was sent and final usage is still draining.
export type VoiceControlActivity =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "executing"
  | "closing"
  | "error";

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
  tools: RealtimeFunctionTool[];
  activationMode: "vad";
  outputMode: "audio";
  audio?: { input?: { capture?: MediaTrackConstraints } };
};

export type UseVoiceControlOptions = {
  auth: { sessionEndpoint: string; sessionRequestInit?: RequestInit };
  tools: VoiceTool<any>[];
  audio?: { input?: { capture?: MediaTrackConstraints } };
  debug?: boolean;
  onGenerationCompleted?: (generation: VoiceControlGeneration) => void;
  // A fatal error has already ended the session; others leave it running.
  onError?: (error: VoiceControlError, context: { fatal: boolean }) => void;
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
  activity: VoiceControlActivity;
  connected: boolean;
  muted: boolean;
  toolCalls: VoiceToolCallRecord[];
  latestToolCall: VoiceToolCallRecord | null;
  sessionConfig: VoiceControlResolvedSessionConfig;
};

export type UseVoiceControlReturn = VoiceControlSnapshot & {
  connect: () => Promise<void>;
  disconnect: () => void;
  setMuted: (muted: boolean) => void;
  interrupt: () => void;
  getOutputAudioLevel: () => number;
  sendContextMessage: (text: string) => void;
};

export type VoiceControlController = UseVoiceControlReturn & {
  configure: (options: UseVoiceControlOptions) => void;
  destroy: () => void;
  getPeerConnection: () => RTCPeerConnection | null;
  getSnapshot: () => VoiceControlSnapshot;
  subscribe: (listener: () => void) => () => void;
};
