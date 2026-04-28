import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/auth";
import {
    createUploadedResources,
    type CreateUploadedResourcesInput,
    type ProcessedUploadResult,
    type UploadVariant,
} from "@/lib/uploads/createUploadedResources";
import { campusValues, examTypeValues, semesterValues } from "@/src/db";

const uploadVariants = new Set<UploadVariant>(["Notes", "Past Papers"]);
const examTypes = new Set<string>(examTypeValues);
const semesters = new Set<string>(semesterValues);
const campuses = new Set<string>(campusValues);

type UploadRequestBody = Partial<Omit<CreateUploadedResourcesInput, "userEmail">>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function nullableStringValue(value: unknown) {
    const string = stringValue(value);
    return string.length > 0 ? string : null;
}

function normalizeResult(value: unknown): ProcessedUploadResult | null {
    if (!isRecord(value)) {
        return null;
    }

    const fileUrl = stringValue(value.fileUrl);
    const filename = stringValue(value.filename);
    const message = stringValue(value.message);

    if (!fileUrl || !filename || !message) {
        return null;
    }

    return {
        fileUrl,
        filename,
        message,
        thumbnailUrl: nullableStringValue(value.thumbnailUrl),
    };
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

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json(
            { success: false, error: "You must be signed in to upload files." },
            { status: 401 },
        );
    }

    let body: UploadRequestBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, error: "Upload request body must be valid JSON." },
            { status: 400 },
        );
    }

    if (!isRecord(body)) {
        return NextResponse.json(
            { success: false, error: "Upload request body must be an object." },
            { status: 400 },
        );
    }

    const variant = stringValue(body.variant) as UploadVariant;
    if (!uploadVariants.has(variant)) {
        return NextResponse.json(
            { success: false, error: "Upload variant is invalid." },
            { status: 400 },
        );
    }

    const results = Array.isArray(body.results)
        ? body.results.map(normalizeResult)
        : [];
    if (results.length === 0 || results.some((result) => result === null)) {
        return NextResponse.json(
            { success: false, error: "Upload results are missing required fields." },
            { status: 400 },
        );
    }

    const examType = nullableStringValue(body.examType);
    const semester = nullableStringValue(body.semester);
    const campus = nullableStringValue(body.campus);
    const examTypeValidation = validateOptionalEnum(examType, examTypes, "Exam type");
    const semesterValidation = validateOptionalEnum(semester, semesters, "Semester");
    const campusValidation = validateOptionalEnum(campus, campuses, "Campus");
    const validationError =
        examTypeValidation.error || semesterValidation.error || campusValidation.error;

    if (validationError) {
        return NextResponse.json(
            { success: false, error: validationError },
            { status: 400 },
        );
    }

    try {
        const result = await createUploadedResources({
            userEmail: session.user.email,
            results: results as ProcessedUploadResult[],
            year: stringValue(body.year),
            slot: stringValue(body.slot),
            variant,
            courseId: nullableStringValue(body.courseId),
            examType,
            semester,
            campus,
            hasAnswerKey: body.hasAnswerKey === true,
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json({ success: true, count: result.data?.length ?? 0 });
    } catch (error) {
        console.error("upload save api error", error);
        const message =
            error instanceof Error
                ? error.message
                : "Unexpected error while saving upload metadata.";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}
