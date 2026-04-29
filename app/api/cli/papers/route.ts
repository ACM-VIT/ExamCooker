import { NextRequest, NextResponse } from "next/server";
import {
  campusValues,
  examTypeValues,
  semesterValues,
  type Campus,
  type ExamType,
  type Semester,
} from "@/db";
import { searchCliPapers } from "@/lib/cli/papers";
import { requireCliRequestUser } from "@/lib/cli/requestAuth";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 250;

function parseOptionalEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
  label: string,
) {
  if (!value) {
    return { value: null as T | null };
  }

  if ((allowed as readonly string[]).includes(value)) {
    return { value: value as T };
  }

  return { error: `${label} is invalid.` };
}

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

function parsePage(rawValue: string | null) {
  if (!rawValue) {
    return 1;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return parsed;
}

function parseOptionalYear(rawValue: string | null) {
  if (!rawValue) {
    return { value: null as number | null };
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: "Year must be a valid number." };
  }

  return { value: parsed };
}

function parseBooleanFlag(rawValue: string | null) {
  return rawValue === "1" || rawValue?.toLowerCase() === "true";
}

export async function GET(request: NextRequest) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  const searchParams = request.nextUrl.searchParams;
  const includeDrafts = parseBooleanFlag(searchParams.get("includeDrafts"));
  const examType = parseOptionalEnum<ExamType>(
    searchParams.get("examType"),
    examTypeValues,
    "Exam type",
  );
  const semester = parseOptionalEnum<Semester>(
    searchParams.get("semester"),
    semesterValues,
    "Semester",
  );
  const campus = parseOptionalEnum<Campus>(
    searchParams.get("campus"),
    campusValues,
    "Campus",
  );
  const year = parseOptionalYear(searchParams.get("year"));

  const validationError =
    examType.error || semester.error || campus.error || year.error;
  if (validationError) {
    return NextResponse.json(
      {
        success: false,
        error: validationError,
      },
      { status: 400 },
    );
  }

  if (includeDrafts && user.role !== "MODERATOR") {
    return NextResponse.json(
      {
        success: false,
        error: "includeDrafts requires moderator access.",
      },
      { status: 403 },
    );
  }

  const result = await searchCliPapers(request.nextUrl.origin, {
    query: searchParams.get("q"),
    course: searchParams.get("course"),
    examType: examType.value,
    year: year.value,
    slot: searchParams.get("slot"),
    semester: semester.value,
    campus: campus.value,
    answerKeysOnly: parseBooleanFlag(searchParams.get("answerKeys")),
    includeDrafts,
    page: parsePage(searchParams.get("page")),
    limit: parseLimit(searchParams.get("limit")),
  });

  return NextResponse.json({
    success: true,
    ...result,
  });
}
