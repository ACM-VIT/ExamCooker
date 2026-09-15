import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientEvent, ResponseEvent } from "openai/resources/live/live";
import { LiveResponseHandler } from "./voice-live-responses";

function event(
  type: string,
  extra: Record<string, unknown> = {},
  delegation = "d1",
): ResponseEvent {
  return {
    type: "response.event",
    event_id: crypto.randomUUID(),
    delegation_id: delegation,
    event: { type, ...extra },
  };
}
function created(id = "r1", delegation = "d1") {
  return event(
    "response.created",
    { response: { id, output: [] } },
    delegation,
  );
}
function completed(id = "r1", delegation = "d1") {
  return event(
    "response.completed",
    { response: { id, output: [] } },
    delegation,
  );
}
function call(id: string, delegation = "d1") {
  return event(
    "response.output_item.done",
    {
      item: {
        type: "function_call",
        name: "inspect_current_view",
        call_id: id,
        arguments: "{}",
      },
    },
    delegation,
  );
}

test("returns every collected call before continuing, even with an empty terminal output", async () => {
  const sent: ClientEvent[] = [];
  const executed: string[] = [];
  const handler = new LiveResponseHandler({
    execute: async (call) => {
      executed.push(call.call_id);
      return '{"ok":true}';
    },
    send: (e) => sent.push(e),
    onError: (e) => {
      throw e;
    },
  });
  handler.handle(created());
  handler.handle(call("a"));
  handler.handle(call("a"));
  handler.handle(call("b"));
  handler.handle(completed());
  handler.handle(completed());
  await handler.settled();
  assert.deepEqual(executed, ["a", "b"]);
  assert.deepEqual(
    sent.map((e) => e.type),
    ["response.item.create", "response.item.create", "response.create"],
  );
  assert.deepEqual(
    sent
      .slice(0, 2)
      .map(
        (e) =>
          e.type === "response.item.create" &&
          e.item.type === "function_call_output" &&
          e.item.call_id,
      ),
    ["a", "b"],
  );
  assert.equal("delegation_id" in sent[2], false);
  handler.handle(completed());
  await handler.settled();
  assert.equal(sent.length, 3);
});

test("late completion is matched by response ID, not the latest response in the delegation", async () => {
  const executed: string[] = [];
  const handler = new LiveResponseHandler({
    execute: async (c) => {
      executed.push(c.call_id);
      return "ok";
    },
    send() {},
    onError: (e) => {
      throw e;
    },
  });
  handler.handle(created("old"));
  handler.handle(call("a"));
  handler.handle(created("new"));
  handler.handle(call("b"));
  handler.handle(completed("old"));
  await handler.settled();
  assert.deepEqual(executed, ["a"]);
  handler.handle(completed("new"));
  await handler.settled();
  assert.deepEqual(executed, ["a", "b"]);
});

test("disconnect suppresses late tool results and queued tool execution", async () => {
  const sent: ClientEvent[] = [];
  const executed: string[] = [];
  let release!: (value: string) => void;
  const pending = new Promise<string>((resolve) => {
    release = resolve;
  });
  const handler = new LiveResponseHandler({
    execute: async (c) => {
      executed.push(c.call_id);
      return pending;
    },
    send: (e) => sent.push(e),
    onError: (e) => {
      throw e;
    },
  });
  handler.handle(created());
  handler.handle(call("a"));
  handler.handle(call("b"));
  handler.handle(completed());
  await Promise.resolve();
  handler.dispose();
  release("done");
  await handler.settled();
  assert.deepEqual(executed, ["a"]);
  assert.deepEqual(sent, []);
});

test("failed tools return an explicit result so the backend can recover", async () => {
  const sent: ClientEvent[] = [];
  const handler = new LiveResponseHandler({
    execute: async () => {
      throw new Error("Control is no longer visible");
    },
    send: (e) => sent.push(e),
    onError: (e) => {
      throw e;
    },
  });
  handler.handle(created());
  handler.handle(call("a"));
  handler.handle(completed());
  await handler.settled();
  const result = sent[0];
  assert.ok(
    result.type === "response.item.create" &&
      result.item.type === "function_call_output",
  );
  assert.deepEqual(JSON.parse(result.item.output as string), {
    ok: false,
    error: "Control is no longer visible",
  });
  assert.equal(sent[1].type, "response.create");
});

test("incomplete reasoning never executes collected actions", async () => {
  const failures: unknown[] = [];
  const handler = new LiveResponseHandler({
    execute: async () => {
      assert.fail("must not execute");
    },
    send: () => {
      assert.fail("must not continue");
    },
    onError: (e) => failures.push(e),
  });
  handler.handle(created());
  handler.handle(call("a"));
  handler.handle(
    event("response.incomplete", { response: { id: "r1", output: [] } }),
  );
  await handler.settled();
  assert.equal(failures.length, 1);
});
