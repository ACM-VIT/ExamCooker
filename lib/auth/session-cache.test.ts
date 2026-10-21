import assert from "node:assert/strict";
import test from "node:test";

type Reply = { ok: boolean; body?: unknown };

// Session requests resolve only when the test says so.
function controlledFetch(t: test.TestContext) {
  const pending: Array<(reply: Reply) => void> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (() => new Promise<Response>((resolve) => {
    pending.push(({ ok, body }) => resolve(new Response(JSON.stringify(body ?? {}), { status: ok ? 200 : 503 })));
  })) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  return { pending, reply(reply: Reply) { pending.shift()!(reply); } };
}

const signedIn = { ok: true, body: { user: { id: "u1", name: "Student" }, expires: "2099-01-01" } };

test("callers share one request; a failed refresh keeps the last answer", async (t) => {
  const { loadAuthSession, clearSessionCache } = await import("./session-cache");
  clearSessionCache();
  const http = controlledFetch(t);

  const first = loadAuthSession();
  const second = loadAuthSession({ refresh: true });
  assert.equal(http.pending.length, 1, "a refresh joins the request in flight");
  http.reply(signedIn);
  assert.equal((await first)?.user?.id, "u1");
  assert.equal(await second, await first);

  const refresh = loadAuthSession({ refresh: true });
  const reader = loadAuthSession();
  assert.equal(reader, refresh, "readers share the running refresh instead of reading the old cache");
  assert.equal(http.pending.length, 1);
  http.reply({ ok: false });
  assert.equal((await refresh)?.user?.id, "u1", "a failed refresh keeps the signed-in session");
});

test("a request started before sign-out cannot restore the old session", async (t) => {
  const { loadAuthSession, clearSessionCache, readCachedSession } = await import("./session-cache");
  clearSessionCache();
  const http = controlledFetch(t);
  const stale = loadAuthSession();
  clearSessionCache();
  const fresh = loadAuthSession();
  assert.equal(http.pending.length, 2);
  const [staleReply, freshReply] = http.pending.splice(0, 2);
  // The signed-out answer arrives first; the older signed-in answer arrives last.
  freshReply({ ok: true, body: {} });
  assert.equal(await fresh, null);
  staleReply(signedIn);
  assert.equal((await stale)?.user?.id, "u1");
  assert.equal(readCachedSession(), null, "the older request must not overwrite the newer answer");
});

test("a failed first request is not mistaken for being signed out", async (t) => {
  const { loadAuthSession, clearSessionCache, readCachedSession } = await import("./session-cache");
  clearSessionCache();
  const http = controlledFetch(t);
  const failed = loadAuthSession();
  http.reply({ ok: false });
  await assert.rejects(failed);
  assert.equal(readCachedSession(), undefined);
  const retry = loadAuthSession();
  assert.equal(http.pending.length, 1, "the next caller asks again");
  http.reply(signedIn);
  assert.equal((await retry)?.user?.id, "u1");
});

test("an answer older than a minute is re-read", async (t) => {
  const { loadAuthSession, clearSessionCache } = await import("./session-cache");
  clearSessionCache();
  t.mock.timers.enable({ apis: ["Date"], now: 0 });
  const http = controlledFetch(t);
  const first = loadAuthSession();
  http.reply(signedIn);
  await first;
  t.mock.timers.setTime(59_000);
  await loadAuthSession();
  assert.equal(http.pending.length, 0, "a recent answer is reused");
  t.mock.timers.setTime(61_000);
  const expired = loadAuthSession();
  assert.equal(http.pending.length, 1);
  http.reply({ ok: true, body: {} });
  assert.equal(await expired, null, "a session that ended elsewhere shows as signed out");
});
