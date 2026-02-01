import { NextResponse } from "next/server";
import { getSyllabusByCourseCode } from "@/lib/data/syllabus";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const syllabus = await getSyllabusByCourseCode(code);

  return NextResponse.json({
    id: syllabus?.id ?? null,
    name: syllabus?.name ?? null,
  });
}
