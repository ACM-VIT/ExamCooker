import { NextRequest, NextResponse } from "next/server";
import {
  resolveCliAccessToken,
  touchCliAccessToken,
} from "@/lib/cli/deviceAuth";
import { verifyCliAccessToken } from "@/lib/cli/tokens";

export type CliRequestUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "MODERATOR";
  tokenId: string;
  tokenLabel: string;
};

function extractBearerToken(request: NextRequest) {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("authentication") ||
    request.headers.get("Authentication");

  if (!authHeader) {
    return null;
  }

  return authHeader.replace(/^Bearer\s+/i, "").trim() || null;
}

export async function getCliRequestUser(request: NextRequest) {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const tokenId = verifyCliAccessToken(token);
  if (!tokenId) {
    return null;
  }

  const record = await resolveCliAccessToken(tokenId);
  if (!record?.userEmail) {
    return null;
  }

  const shouldTouch =
    !record.lastUsedAt || Date.now() - record.lastUsedAt.getTime() > 60_000;
  if (shouldTouch) {
    await touchCliAccessToken(record.id);
  }

  return {
    id: record.userId,
    email: record.userEmail,
    name: record.userName,
    role: record.userRole === "MODERATOR" ? "MODERATOR" : "USER",
    tokenId: record.id,
    tokenLabel: record.label,
  } satisfies CliRequestUser;
}

export async function requireCliRequestUser(request: NextRequest) {
  const authenticatedUser = await getCliRequestUser(request);
  if (!authenticatedUser) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized. Run `examcooker auth login` and try again.",
      },
      { status: 401 },
    );
  }

  return authenticatedUser;
}
