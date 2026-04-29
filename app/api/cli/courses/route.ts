import { NextRequest, NextResponse } from "next/server";
import { requireCliRequestUser } from "@/lib/cli/requestAuth";
import { searchCourseGrid } from "@/lib/data/courseCatalog";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(rawValue: string | null) {
  if (!rawValue) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const courses = await searchCourseGrid(query);

  return NextResponse.json({
    success: true,
    query,
    count: Math.min(limit, courses.length),
    courses: courses.slice(0, limit),
  });
}
