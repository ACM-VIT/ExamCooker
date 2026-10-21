import assert from "node:assert/strict";
import test from "node:test";
import { beginRequestTiming, summarizeRequestTiming, timeRequestWork } from "./request-timing";

test("overlapping waits count once and are split at the response headers", () => {
  const timing = beginRequestTiming({});
  const start = timing.startedAt;
  timing.spans.push(["tags", start + 10, start + 50], ["tags", start + 30, start + 70], ["dbQuery", start + 90, start + 140]);
  assert.deepEqual(summarizeRequestTiming(timing, start + 100, start + 200), {
    headMs: 100, endMs: 200,
    tagsN: 2, tagsHeadMs: 60, tagsMs: 60,
    dbQueryN: 1, dbQueryHeadMs: 10, dbQueryMs: 50,
  });
});

test("work outside a timed request is not recorded", async () => {
  const ctx = {};
  assert.equal(await timeRequestWork(ctx, "dbQuery", async () => 1), 1);
  const timing = beginRequestTiming(ctx);
  await assert.rejects(timeRequestWork(ctx, "dbConnect", async () => { throw new Error("refused"); }));
  assert.equal(timing.spans.length, 1);
  assert.equal(timing.spans[0][0], "dbConnect");
});

test("work still pending at the summary counts up to the boundary", async () => {
  const ctx = {};
  const timing = beginRequestTiming(ctx);
  let finish!: () => void;
  const pending = timeRequestWork(ctx, "tags", () => new Promise<void>((resolve) => { finish = resolve; }));
  const span = timing.spans[0];
  assert.equal(span[2], undefined);
  span[1] = timing.startedAt + 20;
  const summary = summarizeRequestTiming(timing, timing.startedAt + 50, timing.startedAt + 80);
  assert.equal(summary.tagsN, 1);
  assert.equal(summary.tagsHeadMs, 30);
  assert.equal(summary.tagsMs, 60);
  finish();
  await pending;
});

test("spans beyond the cap are counted as dropped", async () => {
  const ctx = {};
  const timing = beginRequestTiming(ctx);
  for (let i = 0; i < 520; i++) await timeRequestWork(ctx, "dbQuery", async () => undefined);
  assert.equal(timing.spans.length, 512);
  assert.equal(summarizeRequestTiming(timing, timing.startedAt, timing.startedAt).droppedSpans, 8);
});
