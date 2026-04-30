import { NextRequest, NextResponse } from "next/server";
import { getPublicAuthOrigin } from "@/lib/auth-origin";
import { getCliPastPaperDetail } from "@/lib/cli/papers";
import { requireCliRequestUser } from "@/lib/cli/request-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const publicOrigin = getPublicAuthOrigin(request);
  const baseUrl = publicOrigin?.origin ?? request.nextUrl.origin;
  const { id } = await context.params;
  const paper = await getCliPastPaperDetail(baseUrl, id);

  if (!paper) {
    return NextResponse.json(
      {
        success: false,
        error: "Paper not found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    paper,
  });
}
