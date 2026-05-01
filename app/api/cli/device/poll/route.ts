import { NextRequest, NextResponse } from "next/server";
import { pollCliDeviceAuthRequest } from "@/lib/cli/device-auth";
import { getPublicAuthOrigin } from "@/lib/auth-origin";

export async function POST(request: NextRequest) {
  let deviceCode = "";

  try {
    const payload = (await request.json()) as { deviceCode?: unknown };
    if (typeof payload?.deviceCode === "string") {
      deviceCode = payload.deviceCode.trim();
    }
  } catch {
    deviceCode = "";
  }

  if (!deviceCode) {
    return NextResponse.json(
      {
        success: false,
        status: "invalid",
        error: "invalid_device_code",
      },
      { status: 400 },
    );
  }

  const result = await pollCliDeviceAuthRequest(deviceCode);
  const publicOrigin = getPublicAuthOrigin(request);
  const baseUrl = publicOrigin?.origin ?? request.nextUrl.origin;

  switch (result.state) {
    case "authorized":
      return NextResponse.json({
        success: true,
        status: "authorized",
        tokenType: "Bearer",
        accessToken: result.accessToken,
        baseUrl,
        user: result.user,
      });
    case "pending":
      return NextResponse.json(
        {
          success: false,
          status: "pending",
          error: "authorization_pending",
        },
        { status: 202 },
      );
    case "denied":
      return NextResponse.json(
        {
          success: false,
          status: "denied",
          error: "access_denied",
        },
        { status: 403 },
      );
    case "expired":
      return NextResponse.json(
        {
          success: false,
          status: "expired",
          error: "expired_token",
        },
        { status: 410 },
      );
    case "invalid":
    default:
      return NextResponse.json(
        {
          success: false,
          status: "invalid",
          error: "invalid_device_code",
        },
        { status: 400 },
      );
  }
}
