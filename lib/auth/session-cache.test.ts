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
  assert.equal(http.pending.length, 1);
  http.reply({ ok: false });
  assert.equal((await refresh)?.user?.id, "u1", "a failed refresh keeps the signed-in session");
  assert.equal((await reader)?.user?.id, "u1", "readers wait for the running refresh");
});

test("a request started before sign-out cannot restore the old session", async (t) => {
  const { loadAuthSession, clearSessionCache } = await import("./session-cache");
  clearSessionCache();
  const http = controlledFetch(t);
  const stale = loadAuthSession();
  clearSessionCache();
  const fresh = loadAuthSession();
  assert.equal(http.pending.length, 2);
  http.reply({ ok: true, body: {} });
  assert.equal(await stale, null);
  http.reply(signedIn);
  await fresh;
  // The later answer wins; the earlier one was discarded by generation.
  assert.equal((await loadAuthSession())?.user?.id, "u1");
});
