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
