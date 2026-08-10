import { NextRequest, NextResponse } from "next/server";
import { createCliDeviceAuthRequest } from "@/lib/cli/device-auth";
import { getPublicAuthOrigin } from "@/lib/auth-origin";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";

const DEVICE_AUTH_RATE_LIMIT = 10;
const DEVICE_AUTH_RATE_WINDOW_MS = 10 * 60 * 1000;

function requestIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) || "unknown";
  return `${address}:${userAgent}`;
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkSlidingWindowRateLimit({
    identifier: requestIdentifier(request),
    limit: DEVICE_AUTH_RATE_LIMIT,
    prefix: "cli-device-auth-start",
    windowMs: DEVICE_AUTH_RATE_WINDOW_MS,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, error: "Too many device authorization requests." },
      { status: 429 },
    );
  }

  let deviceName: string | null = null;

  try {
    const payload = (await request.json()) as { deviceName?: unknown };
    if (typeof payload?.deviceName === "string") {
      const trimmed = payload.deviceName.trim();
      deviceName = trimmed.slice(0, 120) || null;
    }
  } catch {
    deviceName = null;
  }

  const authRequest = await createCliDeviceAuthRequest({ deviceName });
  const publicOrigin = getPublicAuthOrigin(request);
  const baseUrl = publicOrigin?.origin ?? request.nextUrl.origin;
  const verificationUri = `${baseUrl}/cli`;
  const verificationUriComplete = `${verificationUri}?code=${encodeURIComponent(authRequest.userCode)}`;

  return NextResponse.json({
    success: true,
    deviceCode: authRequest.deviceCode,
    userCode: authRequest.userCode,
    verificationUri,
    verificationUriComplete,
    interval: authRequest.interval,
    expiresIn: authRequest.expiresIn,
  });
}
