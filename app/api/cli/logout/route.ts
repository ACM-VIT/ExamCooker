import { NextRequest, NextResponse } from "next/server";
import { revokeCliAccessToken } from "@/lib/cli/deviceAuth";
import { requireCliRequestUser } from "@/lib/cli/requestAuth";

export async function POST(request: NextRequest) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  await revokeCliAccessToken(user.tokenId);

  return NextResponse.json({
    success: true,
    revoked: true,
  });
}
