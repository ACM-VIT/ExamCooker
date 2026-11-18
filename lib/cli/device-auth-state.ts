export const CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS = 5;
export const CLI_DEVICE_AUTH_TTL_SECONDS = 15 * 60;
// An approval near the end of the code's lifetime still leaves the CLI a few
// polls to collect its token.
export const CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS =
  CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS * 12;

// A delivery response can be lost on the way to the CLI, which then polls
// again. For this long after delivery the same device code gets the same
// token back, so the login still completes; after it the code is spent.
export const CLI_DEVICE_AUTH_REDELIVERY_GRACE_SECONDS =
  CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS * 3;

export function canRedeliverCliToken(
  completedAt: Date | null,
  now = Date.now(),
) {
  return (
    completedAt !== null &&
    now - completedAt.getTime() < CLI_DEVICE_AUTH_REDELIVERY_GRACE_SECONDS * 1000
  );
}

/**
 * Lifecycle of a device login request:
 *
 *   pending ──approve──▶ authorized ──first poll──▶ completed
 *      │                     │
 *      ├──deny──▶ denied     └──never collected──▶ expired (token revoked)
 *      └──timeout──▶ expired
 *
 * "authorized" means a token was minted and is waiting for the CLI to collect
 * it. Collecting it completes the request; only a repeat poll within the short
 * re-delivery grace period gets the token again. Rows whose token or user was
 * deleted cannot be delivered.
 */
export type CliDeviceAuthState =
  | "invalid"
  | "pending"
  | "authorized"
  | "completed"
  | "denied"
  | "expired";

export type CliDeviceAuthStateInput = {
  status: "PENDING" | "AUTHORIZED" | "DENIED";
  userId: string | null;
  accessTokenId: string | null;
  completedAt: Date | null;
  expiresAt: Date;
};

export function getCliDeviceAuthState(
  request: CliDeviceAuthStateInput | null | undefined,
  now = Date.now(),
): CliDeviceAuthState {
  if (!request) return "invalid";
  if (request.status === "AUTHORIZED" && request.completedAt) {
    return "completed";
  }
  if (request.expiresAt.getTime() <= now) return "expired";
  if (request.status === "DENIED") return "denied";
  if (request.status === "AUTHORIZED") {
    return request.userId && request.accessTokenId ? "authorized" : "invalid";
  }
  return "pending";
}

export function getCliDeviceAuthDeliveryDeadline(
  expiresAt: Date,
  now = Date.now(),
) {
  return new Date(
    Math.max(
      expiresAt.getTime(),
      now + CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS * 1000,
    ),
  );
}

export type CliDeviceAuthDeliveryInput = {
  status: "PENDING" | "AUTHORIZED" | "DENIED";
  accessTokenId: string | null;
  authorizedAt: Date | null;
  completedAt: Date | null;
  lastPolledAt: Date | null;
  expiresAt: Date;
};

/**
 * Whether an expired request minted a token that no CLI ever collected, so
 * the token has no holder and can be revoked.
 *
 * Deliveries record completedAt. Earlier releases delivered the token on any
 * poll after approval without recording completedAt, and an older deployment
 * may still be serving polls; such a poll leaves lastPolledAt between the
 * approval and the expiry, and that token is in use.
 */
export function isUndeliveredCliToken(request: CliDeviceAuthDeliveryInput) {
  if (request.status !== "AUTHORIZED" || !request.accessTokenId) return false;
  if (request.completedAt) return false;
  const polledAfterApproval =
    request.authorizedAt !== null &&
    request.lastPolledAt !== null &&
    request.lastPolledAt >= request.authorizedAt &&
    request.lastPolledAt < request.expiresAt;
  return !polledAfterApproval;
}
