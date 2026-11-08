export const CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS = 5;
export const CLI_DEVICE_AUTH_TTL_SECONDS = 15 * 60;
// An approval near the end of the code's lifetime still leaves the CLI a few
// polls to collect its token.
export const CLI_DEVICE_AUTH_DELIVERY_WINDOW_SECONDS =
  CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS * 12;

/**
 * Lifecycle of a device login request:
 *
 *   pending ──approve──▶ authorized ──first poll──▶ completed
 *      │                     │
 *      ├──deny──▶ denied     └──never collected──▶ expired (token revoked)
 *      └──timeout──▶ expired
 *
 * "authorized" means a token was minted and is waiting for the CLI to collect
 * it exactly once. Rows whose token or user was deleted cannot be delivered.
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
