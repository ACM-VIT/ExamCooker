import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS,
  getCliDeviceAuthDeliveryDeadline,
  getCliDeviceAuthState,
  type CliDeviceAuthStateInput,
} from "./device-auth-state";

const now = Date.parse("2026-11-08T12:00:00Z");
const later = new Date(now + 60_000);
const earlier = new Date(now - 1);

function request(
  overrides: Partial<CliDeviceAuthStateInput> = {},
): CliDeviceAuthStateInput {
  return {
    status: "PENDING",
    userId: null,
    accessTokenId: null,
    completedAt: null,
    expiresAt: later,
    ...overrides,
  };
}

const approved = { status: "AUTHORIZED", userId: "u", accessTokenId: "t" } as const;

test("a request moves from pending to authorized to completed", () => {
  assert.equal(getCliDeviceAuthState(request(), now), "pending");
  assert.equal(getCliDeviceAuthState(request(approved), now), "authorized");
  assert.equal(
    getCliDeviceAuthState(request({ ...approved, completedAt: earlier }), now),
    "completed",
  );
});

test("expiry ends every open state but not a completed login", () => {
  assert.equal(getCliDeviceAuthState(request({ expiresAt: earlier }), now), "expired");
  assert.equal(
    getCliDeviceAuthState(request({ ...approved, expiresAt: earlier }), now),
    "expired",
  );
  assert.equal(
    getCliDeviceAuthState(request({ status: "DENIED", expiresAt: earlier }), now),
    "expired",
  );
  assert.equal(
    getCliDeviceAuthState(
      request({ ...approved, completedAt: earlier, expiresAt: earlier }),
      now,
    ),
    "completed",
  );
});

test("missing rows and approvals whose token or user was deleted cannot be delivered", () => {
  assert.equal(getCliDeviceAuthState(null, now), "invalid");
  assert.equal(
    getCliDeviceAuthState(request({ ...approved, accessTokenId: null }), now),
    "invalid",
  );
  assert.equal(
    getCliDeviceAuthState(request({ ...approved, userId: null }), now),
    "invalid",
  );
  assert.equal(getCliDeviceAuthState(request({ status: "DENIED" }), now), "denied");
});

test("an approval near expiry leaves the CLI a delivery window", () => {
  const window = CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS * 1000;
  assert.equal(
    getCliDeviceAuthDeliveryDeadline(new Date(now + 1_000), now).getTime(),
    now + window,
  );
  const distant = new Date(now + window * 10);
  assert.equal(getCliDeviceAuthDeliveryDeadline(distant, now).getTime(), distant.getTime());
});
