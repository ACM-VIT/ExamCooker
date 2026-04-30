import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import { getCliDeviceAuthRequestByUserCode } from "@/lib/cli/device-auth";
import { normalizeCliUserCode } from "@/lib/cli/tokens";

type CliLookupState = "idle" | "invalid" | "pending" | "approved" | "expired";

function deriveState(input: {
  userCode: string;
  request: Awaited<ReturnType<typeof getCliDeviceAuthRequestByUserCode>>;
}): CliLookupState {
  if (!input.userCode) return "idle";
  if (!input.request) return "invalid";
  if (input.request.isExpired) return "expired";
  if (input.request.status === "AUTHORIZED") return "approved";
  return "pending";
}

export async function GET(request: NextRequest) {
  const rawCode = request.nextUrl.searchParams.get("code") ?? "";
  const userCode = normalizeCliUserCode(rawCode);

  const [session, deviceRequest] = await Promise.all([
    auth(),
    userCode
      ? getCliDeviceAuthRequestByUserCode(userCode)
      : Promise.resolve(null),
  ]);

  const state = deriveState({
    userCode,
    request: deviceRequest,
  });

  return NextResponse.json({
    success: true,
    state,
    userCode,
    isSignedIn: Boolean(session?.user?.id),
    sessionEmail: session?.user?.email ?? null,
    request: deviceRequest
      ? {
          userCode: deviceRequest.userCode,
          deviceName: deviceRequest.deviceName,
          status: deviceRequest.status,
          userEmail: deviceRequest.userEmail,
          isExpired: deviceRequest.isExpired,
        }
      : null,
  });
}
