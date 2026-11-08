import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import {
  getCliDeviceAuthRequestByUserCode,
  type CliDeviceAuthState,
} from "@/lib/cli/device-auth";
import { normalizeCliUserCode } from "@/lib/cli/tokens";

type CliLookupState =
  | "idle"
  | "invalid"
  | "pending"
  | "approved"
  | "denied"
  | "expired";

function toLookupState(
  userCode: string,
  state: CliDeviceAuthState | undefined,
): CliLookupState {
  if (!userCode) return "idle";
  switch (state) {
    case "pending":
    case "denied":
    case "expired":
      return state;
    case "authorized":
    case "completed":
      return "approved";
    default:
      return "invalid";
  }
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

  const state = toLookupState(userCode, deviceRequest?.state);

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
        }
      : null,
  });
}
