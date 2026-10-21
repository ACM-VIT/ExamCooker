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
