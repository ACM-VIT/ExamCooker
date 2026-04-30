import { NextRequest, NextResponse } from "next/server";
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

  const { id } = await context.params;
  const paper = await getCliPastPaperDetail(request.nextUrl.origin, id);

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
