import type { ClientEvent, ResponseEvent } from "openai/resources/live/live";
import type {
  ResponseStreamEvent,
  ResponseFunctionToolCall,
} from "openai/resources/responses/responses";

export type LiveFunctionCall = ResponseFunctionToolCall;
type Batch = {
  id: string;
  delegationId: string | null;
  calls: Map<string, LiveFunctionCall>;
  terminal: boolean;
};

// Lifecycle snapshots have output: []; completed output-item events own the calls.
export class LiveResponseHandler {
  private batches = new Map<string, Batch>();
  private activeResponses = new Map<string | null, string>();
  private seenCalls = new Set<string>();
  private disposed = false;
  private queue = Promise.resolve();

  constructor(
    private options: {
      execute: (call: LiveFunctionCall) => Promise<string>;
      send: (event: ClientEvent) => void;
      onError: (error: unknown) => void;
      onEvent?: (
        event: ResponseStreamEvent,
        delegationId: string | null,
      ) => void;
    },
  ) {}

  dispose() {
    this.disposed = true;
  }

  handle(envelope: ResponseEvent) {
    if (this.disposed) return;
    const event = envelope.event as unknown as ResponseStreamEvent;
    const delegationId = envelope.delegation_id ?? null;
    this.options.onEvent?.(event, delegationId);
    if (event.type === "response.created") {
      if (!this.batches.has(event.response.id)) {
        this.batches.set(event.response.id, {
          id: event.response.id,
          delegationId,
          calls: new Map(),
          terminal: false,
        });
      }
      this.activeResponses.set(delegationId, event.response.id);
      return;
    }
    const id =
      "response" in event
        ? event.response.id
        : this.activeResponses.get(delegationId);
    const batch = id ? this.batches.get(id) : undefined;
    if (!batch) return;
    if (
      event.type === "response.output_item.done" &&
      event.item.type === "function_call"
    ) {
      if (!batch.terminal) batch.calls.set(event.item.call_id, event.item);
    }
    if (event.type === "response.completed" && !batch.terminal) {
      batch.terminal = true;
      this.queue = this.queue
        .then(() => this.complete(batch))
        .catch(this.options.onError);
    } else if (
      event.type === "response.failed" ||
      event.type === "response.incomplete"
    ) {
      batch.terminal = true;
      this.batches.delete(batch.id);
      this.options.onError(
        new Error(
          "Study reasoning did not finish. Please try that question again.",
        ),
      );
    }
  }

  async settled() {
    await this.queue;
  }

  private async complete(batch: Batch) {
    let submitted = false;
    for (const call of batch.calls.values()) {
      if (this.disposed) return;
      if (this.seenCalls.has(call.call_id)) continue;
      this.seenCalls.add(call.call_id);
      let output: string;
      try {
        output = await this.options.execute(call);
      } catch (error) {
        output = JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : "Tool failed.",
        });
      }
      if (this.disposed) return;
      this.options.send({
        type: "response.item.create",
        event_id: crypto.randomUUID(),
        item: { type: "function_call_output", call_id: call.call_id, output },
      });
      submitted = true;
    }
    // Continue once, after every required result has been returned.
    if (submitted && !this.disposed)
      this.options.send({
        type: "response.create",
        event_id: crypto.randomUUID(),
      });
    this.batches.delete(batch.id);
  }
}
