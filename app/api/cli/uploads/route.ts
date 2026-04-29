import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  campusValues,
  course,
  db,
  examTypeValues,
  semesterValues,
  type Campus,
  type ExamType,
  type Semester,
} from "@/db";
import { normalizeCourseCode } from "@/lib/courseTags";
import { requireCliRequestUser } from "@/lib/cli/requestAuth";
import {
  createUploadedResources,
  type UploadVariant,
} from "@/lib/uploads/createUploadedResources";
import { processUploadFile } from "@/lib/uploads/processorClient";

const uploadVariants = new Set<UploadVariant>(["Notes", "Past Papers"]);
const examTypes = new Set<string>(examTypeValues);
const semesters = new Set<string>(semesterValues);
const campuses = new Set<string>(campusValues);

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableStringValue(value: FormDataEntryValue | null) {
  const normalized = stringValue(value);
  return normalized || null;
}

function parseBoolean(value: FormDataEntryValue | null) {
  const normalized = stringValue(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

function validateOptionalEnum(
  value: string | null,
  allowedValues: Set<string>,
  fieldName: string,
) {
  if (!value || allowedValues.has(value)) {
    return { value };
  }

  return { error: `${fieldName} is invalid.` };
}

function validateRequiredYear(value: string, fieldName: string) {
  if (!/^\d{4}$/.test(value)) {
    return { error: `${fieldName} must be a 4-digit year.` };
  }

  return { value };
}

async function resolveCourseId(input: {
  courseId: string | null;
  courseCode: string | null;
}) {
  if (input.courseId) {
    const rows = await db
      .select({ id: course.id, code: course.code })
      .from(course)
      .where(eq(course.id, input.courseId))
      .limit(1);

    return rows[0] ?? null;
  }

  if (!input.courseCode) {
    return null;
  }

  const normalizedCourseCode = normalizeCourseCode(input.courseCode);
  const rows = await db
    .select({ id: course.id, code: course.code })
    .from(course)
    .where(eq(course.code, normalizedCourseCode))
    .limit(1);

  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  const user = await requireCliRequestUser(request);
  if (user instanceof NextResponse) {
    return user;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Upload request must be multipart/form-data.",
      },
      { status: 400 },
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: "Upload request is missing a `file` field.",
      },
      { status: 400 },
    );
  }

  if (
    fileEntry.type !== "application/pdf" &&
    !fileEntry.name.toLowerCase().endsWith(".pdf")
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Only PDF uploads are supported by the CLI right now.",
      },
      { status: 400 },
    );
  }

  const variant = (stringValue(formData.get("variant")) ||
    "Past Papers") as UploadVariant;
  if (!uploadVariants.has(variant)) {
    return NextResponse.json(
      {
        success: false,
        error: "Upload variant is invalid.",
      },
      { status: 400 },
    );
  }

  const title = stringValue(formData.get("title")) || stripExtension(fileEntry.name);
  const courseId = nullableStringValue(formData.get("courseId"));
  const courseCode = nullableStringValue(formData.get("course"));
  const examType = nullableStringValue(formData.get("examType"));
  const semester = nullableStringValue(formData.get("semester"));
  const campus = nullableStringValue(formData.get("campus"));
  const year = stringValue(formData.get("year"));
  const slot = stringValue(formData.get("slot"));
  const hasAnswerKey = parseBoolean(formData.get("answerKey"));
  const yearValidation =
    variant === "Past Papers"
      ? validateRequiredYear(year, "Year")
      : { value: year };

  const examTypeValidation = validateOptionalEnum(examType, examTypes, "Exam type");
  const semesterValidation = validateOptionalEnum(semester, semesters, "Semester");
  const campusValidation = validateOptionalEnum(campus, campuses, "Campus");
  const validationError =
    examTypeValidation.error ||
    semesterValidation.error ||
    campusValidation.error ||
    yearValidation.error;

  if (validationError) {
    return NextResponse.json(
      {
        success: false,
        error: validationError,
      },
      { status: 400 },
    );
  }

  const resolvedCourse = await resolveCourseId({ courseId, courseCode });
  if (variant === "Past Papers" && !resolvedCourse) {
    return NextResponse.json(
      {
        success: false,
        error: "Past paper uploads require a valid course code or courseId.",
      },
      { status: 400 },
    );
  }

  if (variant === "Past Papers" && !examType) {
    return NextResponse.json(
      {
        success: false,
        error: "Past paper uploads require an exam type.",
      },
      { status: 400 },
    );
  }

  if (variant === "Past Papers" && !year) {
    return NextResponse.json(
      {
        success: false,
        error: "Past paper uploads require a year.",
      },
      { status: 400 },
    );
  }

  try {
    const processedFile = await processUploadFile({
      file: fileEntry,
      title,
    });

    const result = await createUploadedResources({
      userEmail: user.email,
      results: [processedFile],
      year: yearValidation.value ?? year,
      slot,
      variant,
      courseId: resolvedCourse?.id ?? null,
      examType: examType as ExamType | null,
      semester: semester as Semester | null,
      campus: campus as Campus | null,
      hasAnswerKey,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    const created = result.data?.[0] ?? null;
    return NextResponse.json({
      success: true,
      upload: {
        id: created?.id ?? null,
        title: created?.title ?? title,
        variant,
        course: resolvedCourse,
        hasAnswerKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while uploading the file.",
      },
      { status: 500 },
    );
  }
}
