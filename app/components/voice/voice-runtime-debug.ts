import type { RealtimeServerEvent } from "./voice-runtime-types";

function redactLargeString(value: string) {
  if (value.length <= 240) {
    return value;
  }

  return `${value.slice(0, 240)}... (${value.length} chars)`;
}

export function summarizeRealtimeEvent(event: RealtimeServerEvent) {
  const summary: Record<string, unknown> = {
    type: event.type,
  };

  if (typeof event.event_id === "string") summary.eventId = event.event_id;
  if (typeof event.item_id === "string") summary.itemId = event.item_id;
  if (typeof event.response_id === "string") summary.responseId = event.response_id;
  if (typeof event.output_index === "number") summary.outputIndex = event.output_index;
  if (typeof event.content_index === "number") summary.contentIndex = event.content_index;

  if (typeof event.delta === "string") {
    summary.delta = redactLargeString(event.delta);
  }

  if (typeof event.transcript === "string") {
    summary.transcript = redactLargeString(event.transcript);
  }

  if (typeof event.text === "string") {
    summary.text = redactLargeString(event.text);
  }

  if (event.response && typeof event.response === "object") {
    const response = event.response as {
      conversation_id?: string | null;
      id?: string | null;
      status?: string | null;
      status_details?: unknown;
      usage?: unknown;
    };
    summary.response = {
      conversationId: response.conversation_id ?? null,
      id: response.id ?? null,
      status: response.status ?? null,
      statusDetails: response.status_details ?? null,
      usage: response.usage ?? null,
    };
  }

  if (event.error && typeof event.error === "object") {
    summary.error = event.error;
  }

  return summary;
}

export function shouldLogRealtimeEvent(event: RealtimeServerEvent) {
  return (
    event.type === "error" ||
    event.type.startsWith("input_audio_buffer.") ||
    event.type.startsWith("conversation.item.input_audio_transcription.") ||
    event.type.startsWith("response.") ||
    event.type.includes("function_call")
  );
}
