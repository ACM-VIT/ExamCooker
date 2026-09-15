import assert from "node:assert/strict";
import { test } from "node:test";
import { isVoiceRequestSameOrigin } from "./request-origin";

function proxiedRequest(origin: string, extra: Record<string, string> = {}) {
  return new Request("http://internal-container:8080/api/live/session", {
    headers: {
      origin,
      host: "internal-container:8080",
      "x-forwarded-host": "examcooker.acmvit.in",
      "x-forwarded-proto": "https",
      ...extra,
    },
  });
}

test("voice accepts the public HTTPS origin behind an internal HTTP proxy", () => {
  assert.equal(isVoiceRequestSameOrigin(proxiedRequest("https://examcooker.acmvit.in")), true);
  assert.equal(isVoiceRequestSameOrigin(proxiedRequest("https://exam-cooker.acmvit.in", {
    "x-forwarded-host": "exam-cooker.acmvit.in, internal-container:8080",
    "x-forwarded-proto": "https, http",
  })), true);
  for (const hostHeader of ["host", "x-original-host", "x-ms-original-host"]) {
    assert.equal(isVoiceRequestSameOrigin(proxiedRequest("https://examcooker.acmvit.in", {
      "x-forwarded-host": "",
      [hostHeader]: "examcooker.acmvit.in",
    })), true);
  }
});

test("voice rejects foreign, malformed, and mismatched origins behind the proxy", () => {
  for (const origin of [
    "https://evil.example", "https://examcooker.acmvit.in.evil.example",
    "http://examcooker.acmvit.in", "https://examcooker.acmvit.in:8443",
    "https://beta.examcooker.acmvit.in", "null", "", "https://examcooker.acmvit.in/path",
  ]) {
    assert.equal(isVoiceRequestSameOrigin(proxiedRequest(origin)), false, origin);
  }
  assert.equal(isVoiceRequestSameOrigin(proxiedRequest("https://evil.example", {
    "x-forwarded-host": "evil.example",
    referer: "https://evil.example/",
    cookie: "examcooker.auth-origin=https://evil.example",
  })), false);
});

test("caller-controlled origin and callback cookies cannot define the destination", () => {
  const request = new Request("http://internal-container:8080/api/live/session", {
    headers: {
      origin: "https://beta.examcooker.acmvit.in",
      referer: "https://beta.examcooker.acmvit.in/",
      cookie: "examcooker.auth-origin=https://beta.examcooker.acmvit.in",
    },
  });
  assert.equal(isVoiceRequestSameOrigin(request), false);
});

test("direct requests and local development retain origin checks", () => {
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3011", "https://examcooker.acmvit.in"]) {
    assert.equal(isVoiceRequestSameOrigin(new Request(`${origin}/api/live/session`, {
      headers: { origin, host: new URL(origin).host },
    })), true);
  }
  assert.equal(isVoiceRequestSameOrigin(new Request("http://localhost:3000/api/live/session", {
    headers: { origin: "http://localhost:3001", host: "localhost:3000" },
  })), false);
  assert.equal(isVoiceRequestSameOrigin(new Request("https://examcooker.acmvit.in/api/live/session")), true);
});
