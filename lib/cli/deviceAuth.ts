import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, cliAccessToken, cliDeviceAuthRequest, user } from "@/db";
import {
  buildCliAccessToken,
  buildCliTokenLabel,
  generateCliDeviceCode,
  generateCliUserCode,
  hashCliDeviceCode,
  normalizeCliUserCode,
} from "@/lib/cli/tokens";

export const CLI_DEVICE_AUTH_POLL_INTERVAL_SECONDS = 5;
export const CLI_DEVICE_AUTH_TTL_SECONDS = 15 * 60;

export type CliDeviceAuthState =
  | "invalid"
  | "pending"
  | "authorized"
  | "denied"
  | "expired";

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() <= Date.now();
}

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

export async function createCliDeviceAuthRequest(input?: {
  deviceName?: string | null;
}) {
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
    isExpired: isExpired(request.expiresAt),
  };
}

export async function authorizeCliDeviceAuthRequest(input: {
  userCode: string;
  userId: string;
}) {
  const request = await getCliDeviceAuthRequestByUserCode(input.userCode);
  if (!request) {
    return { state: "invalid" as const };
  }
  if (request.isExpired) {
    return { state: "expired" as const, request };
  }

  const existingTokenIdRows = await db
    .select({ accessTokenId: cliDeviceAuthRequest.accessTokenId })
    .from(cliDeviceAuthRequest)
    .where(eq(cliDeviceAuthRequest.id, request.id))
    .limit(1);
  const existingTokenId = existingTokenIdRows[0]?.accessTokenId ?? null;

  if (request.status === "AUTHORIZED") {
    return {
      state: "authorized" as const,
      request,
      accessToken: existingTokenId
        ? buildCliAccessToken(existingTokenId)
        : undefined,
    };
  }
  if (request.status === "DENIED") {
    return { state: "denied" as const, request };
  }

  const tokenRows =
    existingTokenId
      ? await db
          .select({
            id: cliAccessToken.id,
            userId: cliAccessToken.userId,
          })
          .from(cliAccessToken)
          .where(eq(cliAccessToken.id, existingTokenId))
          .limit(1)
      : [];

  const token =
    (tokenRows[0] && tokenRows[0].userId === input.userId ? tokenRows[0] : null) ??
    (
      await db
        .insert(cliAccessToken)
        .values({
          userId: input.userId,
          label: buildCliTokenLabel(request.deviceName),
        })
        .returning({
          id: cliAccessToken.id,
          userId: cliAccessToken.userId,
        })
    )[0];

  await db
    .update(cliDeviceAuthRequest)
    .set({
      status: "AUTHORIZED",
      userId: input.userId,
      accessTokenId: token.id,
      authorizedAt: request.authorizedAt ?? new Date(),
    })
    .where(eq(cliDeviceAuthRequest.id, request.id));

  return {
    state: "authorized" as const,
    request: {
      ...request,
      status: "AUTHORIZED" as const,
      userId: input.userId,
      authorizedAt: request.authorizedAt ?? new Date(),
    },
    accessToken: buildCliAccessToken(token.id),
  };
}

export async function pollCliDeviceAuthRequest(deviceCode: string) {
  const deviceCodeHash = hashCliDeviceCode(deviceCode);
  const rows = await db
    .select({
      id: cliDeviceAuthRequest.id,
      deviceName: cliDeviceAuthRequest.deviceName,
      status: cliDeviceAuthRequest.status,
      userId: cliDeviceAuthRequest.userId,
      accessTokenId: cliDeviceAuthRequest.accessTokenId,
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
  if (!request) {
    return { state: "invalid" as const };
  }

  await db
    .update(cliDeviceAuthRequest)
    .set({ lastPolledAt: new Date() })
    .where(eq(cliDeviceAuthRequest.id, request.id));

  if (isExpired(request.expiresAt)) {
    return { state: "expired" as const };
  }
  if (request.status === "DENIED") {
    return { state: "denied" as const };
  }
  if (
    request.status !== "AUTHORIZED" ||
    !request.userId ||
    !request.accessTokenId
  ) {
    return { state: "pending" as const };
  }

  return {
    state: "authorized" as const,
    accessToken: buildCliAccessToken(request.accessTokenId),
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
