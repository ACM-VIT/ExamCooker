import { NextRequest, NextResponse } from "next/server";
import { requireCliRequestUser } from "@/lib/cli/requestAuth";

export async function GET(request: NextRequest) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    token: {
      id: user.tokenId,
      label: user.tokenLabel,
    },
  });
}
