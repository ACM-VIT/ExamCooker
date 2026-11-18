import { and, eq, gt, inArray, isNull, lt, or } from "drizzle-orm";
import { db, cliAccessToken, cliDeviceAuthRequest, user } from "@/db";
import {
  buildCliAccessToken,
  buildCliTokenLabel,
  generateCliDeviceCode,
  generateCliUserCode,
  hashCliDeviceCode,
  normalizeCliUserCode,
} from "@/lib/cli/tokens";
import {
  CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS,
  CLI_DEVICE_AUTH_TTL_SECONDS,
  canRedeliverCliToken,
  getCliDeviceAuthDeliveryDeadline,
  getCliDeviceAuthState,
  isUndeliveredCliToken,
  type CliDeviceAuthState,
} from "@/lib/cli/device-auth-state";

export type { CliDeviceAuthState } from "@/lib/cli/device-auth-state";

async function createUniqueUserCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const userCode = generateCliUserCode();
    const existing = await db
      .select({ id: cliDeviceAuthRequest.id })
      .from(cliDeviceAuthRequest)
      .where(eq(cliDeviceAuthRequest.userCode, userCode))
      .limit(1);

    if (!existing[0]) {
      return userCode;
    }
  }

  throw new Error("Failed to generate a unique ExamCooker CLI user code.");
}

async function deleteExpiredCliDeviceAuthRequests(now: Date) {
  await db.transaction(async (tx) => {
    const expired = await tx
      .delete(cliDeviceAuthRequest)
      .where(lt(cliDeviceAuthRequest.expiresAt, now))
      .returning({
        status: cliDeviceAuthRequest.status,
        accessTokenId: cliDeviceAuthRequest.accessTokenId,
        authorizedAt: cliDeviceAuthRequest.authorizedAt,
        completedAt: cliDeviceAuthRequest.completedAt,
        lastPolledAt: cliDeviceAuthRequest.lastPolledAt,
        expiresAt: cliDeviceAuthRequest.expiresAt,
      });

    // A token minted for a login the CLI never collected has no holder.
    const undeliveredTokenIds = expired.flatMap((request) =>
      isUndeliveredCliToken(request) && request.accessTokenId
        ? [request.accessTokenId]
        : [],
    );
    if (undeliveredTokenIds.length === 0) return;

    await tx
      .update(cliAccessToken)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          inArray(cliAccessToken.id, undeliveredTokenIds),
          isNull(cliAccessToken.revokedAt),
        ),
      );
  });
}

export async function createCliDeviceAuthRequest(input?: {
  deviceName?: string | null;
}) {
  await deleteExpiredCliDeviceAuthRequests(new Date());

  const deviceCode = generateCliDeviceCode();
  const userCode = await createUniqueUserCode();
  const now = Date.now();
  const expiresAt = new Date(now + CLI_DEVICE_AUTH_TTL_SECONDS * 1000);

  const rows = await db
    .insert(cliDeviceAuthRequest)
    .values({
      userCode,
      deviceCodeHash: hashCliDeviceCode(deviceCode),
      deviceName: input?.deviceName?.trim() || null,
      expiresAt,
    })
    .returning({
      id: cliDeviceAuthRequest.id,
      userCode: cliDeviceAuthRequest.userCode,
      deviceName: cliDeviceAuthRequest.deviceName,
      expiresAt: cliDeviceAuthRequest.expiresAt,
      createdAt: cliDeviceAuthRequest.createdAt,
    });

  return {
    ...rows[0],
    deviceCode,
    expiresIn: CLI_DEVICE_AUTH_TTL_SECONDS,
    interval: CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS,
  };
}

export async function getCliDeviceAuthRequestByUserCode(userCode: string) {
  const normalizedCode = normalizeCliUserCode(userCode);
  if (!normalizedCode) {
    return null;
  }

  const rows = await db
    .select({
      id: cliDeviceAuthRequest.id,
      userCode: cliDeviceAuthRequest.userCode,
      deviceName: cliDeviceAuthRequest.deviceName,
      status: cliDeviceAuthRequest.status,
      userId: cliDeviceAuthRequest.userId,
      accessTokenId: cliDeviceAuthRequest.accessTokenId,
      authorizedAt: cliDeviceAuthRequest.authorizedAt,
      completedAt: cliDeviceAuthRequest.completedAt,
      expiresAt: cliDeviceAuthRequest.expiresAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(cliDeviceAuthRequest)
    .leftJoin(user, eq(cliDeviceAuthRequest.userId, user.id))
    .where(eq(cliDeviceAuthRequest.userCode, normalizedCode))
    .limit(1);

  const request = rows[0];
  if (!request) {
    return null;
  }

  return {
    ...request,
    state: getCliDeviceAuthState(request),
  };
}

async function readCliDeviceAuthState(userCode: string) {
  const request = await getCliDeviceAuthRequestByUserCode(userCode);
  return request?.state ?? "invalid";
}

/**
 * Approves a pending request. Only one approval can win: the status change is
 * a compare-and-set, and the token is minted in the same transaction.
 */
export async function authorizeCliDeviceAuthRequest(input: {
  userCode: string;
  userId: string;
}): Promise<CliDeviceAuthState> {
  const request = await getCliDeviceAuthRequestByUserCode(input.userCode);
  if (!request || request.state !== "pending") {
    return request?.state ?? "invalid";
  }

  const authorized = await db.transaction(async (tx) => {
    const now = new Date();
    const claimed = await tx
      .update(cliDeviceAuthRequest)
      .set({
        status: "AUTHORIZED",
        userId: input.userId,
        authorizedAt: now,
        expiresAt: getCliDeviceAuthDeliveryDeadline(
          request.expiresAt,
          now.getTime(),
        ),
      })
      .where(
        and(
          eq(cliDeviceAuthRequest.id, request.id),
          eq(cliDeviceAuthRequest.status, "PENDING"),
          gt(cliDeviceAuthRequest.expiresAt, now),
        ),
      )
      .returning({ id: cliDeviceAuthRequest.id });
    if (!claimed[0]) return false;

    const [token] = await tx
      .insert(cliAccessToken)
      .values({
        userId: input.userId,
        label: buildCliTokenLabel(request.deviceName),
      })
      .returning({ id: cliAccessToken.id });
    await tx
      .update(cliDeviceAuthRequest)
      .set({ accessTokenId: token.id })
      .where(eq(cliDeviceAuthRequest.id, request.id));
    return true;
  });

  return authorized ? "authorized" : readCliDeviceAuthState(input.userCode);
}

export async function denyCliDeviceAuthRequest(input: {
  userCode: string;
}): Promise<CliDeviceAuthState> {
  const request = await getCliDeviceAuthRequestByUserCode(input.userCode);
  if (!request || request.state !== "pending") {
    return request?.state ?? "invalid";
  }

  const now = new Date();
  const denied = await db
    .update(cliDeviceAuthRequest)
    .set({ status: "DENIED" })
    .where(
      and(
        eq(cliDeviceAuthRequest.id, request.id),
        eq(cliDeviceAuthRequest.status, "PENDING"),
        gt(cliDeviceAuthRequest.expiresAt, now),
      ),
    )
    .returning({ id: cliDeviceAuthRequest.id });

  return denied[0] ? "denied" : readCliDeviceAuthState(input.userCode);
}

/**
 * Delivers an approved token once. A repeat poll within a short grace period
 * gets the same token again, because the first response may never have reached
 * the CLI; after that the device code is spent, so a leaked code cannot fetch
 * the token.
 */
export async function pollCliDeviceAuthRequest(deviceCode: string) {
  const deviceCodeHash = hashCliDeviceCode(deviceCode);
  const rows = await db
    .select({
      id: cliDeviceAuthRequest.id,
      status: cliDeviceAuthRequest.status,
      userId: cliDeviceAuthRequest.userId,
      accessTokenId: cliDeviceAuthRequest.accessTokenId,
      completedAt: cliDeviceAuthRequest.completedAt,
      expiresAt: cliDeviceAuthRequest.expiresAt,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
    })
    .from(cliDeviceAuthRequest)
    .leftJoin(user, eq(cliDeviceAuthRequest.userId, user.id))
    .where(eq(cliDeviceAuthRequest.deviceCodeHash, deviceCodeHash))
    .limit(1);

  const request = rows[0];
  const state = getCliDeviceAuthState(request);
  if (!request) return { state: "invalid" as const };
  if (state !== "authorized" && state !== "completed") return { state };

  const now = new Date();
  let delivery = {
    accessTokenId: request.accessTokenId,
    completedAt: request.completedAt,
  };
  let deliveredNow = false;
  if (state === "authorized") {
    const delivered = await db
      .update(cliDeviceAuthRequest)
      .set({ completedAt: now })
      .where(
        and(
          eq(cliDeviceAuthRequest.id, request.id),
          eq(cliDeviceAuthRequest.status, "AUTHORIZED"),
          isNull(cliDeviceAuthRequest.completedAt),
          gt(cliDeviceAuthRequest.expiresAt, now),
        ),
      )
      .returning({
        accessTokenId: cliDeviceAuthRequest.accessTokenId,
        completedAt: cliDeviceAuthRequest.completedAt,
      });
    if (delivered[0]) {
      delivery = delivered[0];
      deliveredNow = true;
    } else {
      // A concurrent poll delivered it first; see whether this one may repeat it.
      const [current] = await db
        .select({
          accessTokenId: cliDeviceAuthRequest.accessTokenId,
          completedAt: cliDeviceAuthRequest.completedAt,
        })
        .from(cliDeviceAuthRequest)
        .where(eq(cliDeviceAuthRequest.id, request.id))
        .limit(1);
      if (!current) return { state: "invalid" as const };
      delivery = current;
    }
  }

  const accessTokenId = delivery.accessTokenId;
  if (
    !accessTokenId ||
    !request.userId ||
    !(deliveredNow || canRedeliverCliToken(delivery.completedAt, now.getTime()))
  ) {
    return { state: "invalid" as const };
  }

  return {
    state: "authorized" as const,
    accessToken: buildCliAccessToken(accessTokenId),
    user: {
      id: request.userId,
      email: request.userEmail,
      name: request.userName,
      role: request.userRole,
    },
  };
}

export async function revokeCliAccessToken(tokenId: string) {
  await db
    .update(cliAccessToken)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cliAccessToken.id, tokenId));
}

export async function resolveCliAccessToken(tokenId: string) {
  const rows = await db
    .select({
      id: cliAccessToken.id,
      userId: cliAccessToken.userId,
      label: cliAccessToken.label,
      lastUsedAt: cliAccessToken.lastUsedAt,
      revokedAt: cliAccessToken.revokedAt,
      expiresAt: cliAccessToken.expiresAt,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
    })
    .from(cliAccessToken)
    .innerJoin(user, eq(cliAccessToken.userId, user.id))
    .where(
      and(
        eq(cliAccessToken.id, tokenId),
        isNull(cliAccessToken.revokedAt),
        or(isNull(cliAccessToken.expiresAt), gt(cliAccessToken.expiresAt, new Date())),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function touchCliAccessToken(tokenId: string) {
  await db
    .update(cliAccessToken)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cliAccessToken.id, tokenId));
}
