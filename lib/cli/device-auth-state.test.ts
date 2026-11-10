import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS,
  CLI_DEVICE_AUTH_REDELIVERY_GRACE_SECONDS,
  canRedeliverCliToken,
  getCliDeviceAuthDeliveryDeadline,
  getCliDeviceAuthState,
  isUndeliveredCliToken,
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

test("cleanup revokes only tokens no CLI collected, including legacy deliveries", () => {
  const authorizedAt = new Date(now - 10 * 60_000);
  const expiresAt = new Date(now - 60_000);
  const expired = {
    status: "AUTHORIZED" as const,
    accessTokenId: "t",
    authorizedAt,
    completedAt: null,
    lastPolledAt: null,
    expiresAt,
  };

  assert.equal(isUndeliveredCliToken(expired), true, "approved but never polled");
  assert.equal(isUndeliveredCliToken({ ...expired, completedAt: authorizedAt }), false);
  // An earlier release delivered on any poll after approval without completedAt.
  assert.equal(
    isUndeliveredCliToken({ ...expired, lastPolledAt: new Date(authorizedAt.getTime() + 5_000) }),
    false,
  );
  // Polls before approval or after expiry never returned the token.
  assert.equal(
    isUndeliveredCliToken({ ...expired, lastPolledAt: new Date(authorizedAt.getTime() - 5_000) }),
    true,
  );
  assert.equal(isUndeliveredCliToken({ ...expired, lastPolledAt: expiresAt }), true);
  assert.equal(isUndeliveredCliToken({ ...expired, status: "PENDING", accessTokenId: null }), false);
});

test("a delivered token can be fetched again only within the grace period", () => {
  const grace = CLI_DEVICE_AUTH_REDELIVERY_GRACE_SECONDS * 1000;
  assert.equal(canRedeliverCliToken(null, now), false, "never delivered");
  assert.equal(canRedeliverCliToken(new Date(now - 1_000), now), true);
  assert.equal(canRedeliverCliToken(new Date(now - grace), now), false);
});
