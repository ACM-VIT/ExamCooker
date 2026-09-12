import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";

const base = new URL(process.env.TEST_BASE_URL || "https://ec-test.acmvit.in");
const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
assert.ok(secret, "Set AUTH_SECRET for the deployment being tested");
assert.equal(base.hostname, "ec-test.acmvit.in", "This probe is restricted to the test deployment");

// Synthetic, short-lived JWTs exercise the real session endpoint without creating
// accounts, impersonating users, or persisting credentials. They have no database
// user ID and cannot pass the application's auth() database-user check.
const names = [`cache-probe-a-${randomUUID()}`, `cache-probe-b-${randomUUID()}`];
const tokens = await Promise.all(names.map((name) => encode({
  secret, maxAge: 60, token: { name, email: `${name}@example.invalid`, sub: randomUUID() },
})));
const cookie = (i) => `__Secure-next-auth.session-token=${tokens[i]}`;
async function checkSession(index, chunked = false) {
  let headers = {};
  if (index !== null) {
    const token = tokens[index];
    const halfway = Math.floor(token.length / 2);
    headers = { cookie: chunked
      ? `__Secure-next-auth.session-token.0=${token.slice(0, halfway)}; __Secure-next-auth.session-token.1=${token.slice(halfway)}`
      : cookie(index) };
  }
  const response = await fetch(new URL("/api/auth/session", base), { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.notEqual(response.headers.get("cf-cache-status"), "HIT");
  const session = await response.json();
  if (index === null) assert.deepEqual(session, {});
  else assert.equal(session.user.name, names[index]);
}
for (const index of [0, 1, null, 1, 0, null]) await checkSession(index);
await Promise.all(Array.from({ length: 18 }, (_, i) => checkSession([0, 1, null][i % 3])));
await checkSession(0, true);
await checkSession(1, true);
console.log("PASS: alternating and concurrent A/B/anonymous sessions, including chunked cookies, stay isolated");

const csrf = await Promise.all(Array.from({ length: 3 }, async () => {
  const response = await fetch(new URL("/api/auth/csrf", base));
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  return (await response.json()).csrfToken;
}));
assert.equal(new Set(csrf).size, csrf.length);
console.log("PASS: anonymous CSRF tokens are not shared");

const redirect = await fetch(new URL("/api/auth/init?redirect=/", base), { redirect: "manual" });
assert.equal(new URL(redirect.headers.get("location")).hostname, base.hostname);
for (const headers of [{}, { rsc: "1" }, { cookie: cookie(0) }, { cookie: cookie(1) }]) {
  const response = await fetch(base, { headers, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.notEqual(response.headers.get("cf-cache-status"), "HIT");
  assert.ok((await response.text()).length > 0, "Response stream must complete");
}
console.log("PASS: auth redirects stay on the test hostname; HTML and RSC responses are not shared HTTP cache hits");
