import assert from "node:assert/strict";
import { test } from "node:test";
import { expireAiSessionCookie } from "./session-cookie";

test("sign-out keeps auth cookies and expires the AI session cookie", async () => {
  const authResponse = new Response("signed out", {
    headers: { "Set-Cookie": "authjs.session-token=; Max-Age=0; Path=/; HttpOnly" },
  });
  const response = expireAiSessionCookie(authResponse, true);
  const cookies = response.headers.getSetCookie();

  assert.equal(await response.text(), "signed out");
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^authjs\.session-token=/);
  assert.match(cookies[1], /^ec-ai-session=; Max-Age=0; Path=\/; HttpOnly; SameSite=Lax; Secure$/);
});
