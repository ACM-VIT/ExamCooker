import assert from "node:assert/strict";
import { it, mock } from "node:test";
import { logMcpError } from "./error-logging";

it("retains nested error codes and stack frames without logging credentials or extra fields", () => {
  const previous = process.env.MCP_TEST_SECRET;
  process.env.MCP_TEST_SECRET = "sensitive-test-value";
  const logged = mock.method(console, "error", () => {});
  try {
    const cause = Object.assign(new Error("connect postgres://user:pass@db.invalid/study?token=private"), { code: "ECONNREFUSED" });
    const error = Object.assign(new Error("Resource failed: password=hidden api_key='also-hidden' Bearer bearer-value sensitive-test-value", { cause }), { query: "private SQL" });
    logMcpError("MCP failed", error);
    logMcpError("MCP query failed", new Error("Failed query: select * from users where email = 'private@example.com'\nparams: private-value", { cause }));
    assert.ok(!JSON.stringify(logged.mock.calls[1].arguments).includes("private@example.com"));
    assert.ok(!JSON.stringify(logged.mock.calls[1].arguments).includes("private-value"));
    const output = JSON.stringify(logged.mock.calls[0].arguments);
    for (const secret of ["user:pass", "db.invalid", "private", "hidden", "also-hidden", "bearer-value", "sensitive-test-value", "private SQL"]) {
      assert.ok(!output.includes(secret), secret);
    }
    assert.match(output, /ECONNREFUSED/);
    assert.match(output, /Resource failed/);
    assert.match(output, /error-logging.test.ts/);
  } finally {
    logged.mock.restore();
    if (previous === undefined) delete process.env.MCP_TEST_SECRET;
    else process.env.MCP_TEST_SECRET = previous;
  }
});

it("handles cyclic causes and non-Error thrown values without leaking their contents", () => {
  const logged = mock.method(console, "error", () => {});
  try {
    const error = new Error("outer");
    error.cause = error;
    logMcpError("MCP failed", error);
    logMcpError("MCP failed", { password: "do-not-log" });
    assert.match(JSON.stringify(logged.mock.calls[0].arguments), /CircularCause/);
    assert.ok(!JSON.stringify(logged.mock.calls[1].arguments).includes("do-not-log"));
  } finally {
    logged.mock.restore();
  }
});
