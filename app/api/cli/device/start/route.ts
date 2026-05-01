import { NextRequest, NextResponse } from "next/server";
import { createCliDeviceAuthRequest } from "@/lib/cli/device-auth";
import { getPublicAuthOrigin } from "@/lib/auth-origin";

export async function POST(request: NextRequest) {
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
