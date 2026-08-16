import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { auth } from "@/app/auth";
import {
    createUploadedResources,
    runUploadedResourcePostSaveTasks,
    type CreateUploadedResourcesInput,
    type UploadVariant,
} from "@/lib/uploads/create-uploaded-resources";
import { campusValues, db, examTypeValues, semesterValues, uploadResultReceipt } from "@/db";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";

const MAX_UPLOAD_BATCH = 8;
const SAVE_RATE_LIMIT = 12;
const SAVE_RATE_WINDOW_MS = 60 * 60 * 1000;
const uploadVariants = new Set<UploadVariant>(["Notes", "Past Papers"]);
const examTypes = new Set<string>(examTypeValues);
const semesters = new Set<string>(semesterValues);
const campuses = new Set<string>(campusValues);

type UploadRequestBody = Partial<
    Omit<CreateUploadedResourcesInput, "userEmail" | "results">
> & { results?: unknown };

class UploadSaveValidationError extends Error {
    constructor(readonly result: { success: false; error: string }) {
        super(result.error);
        this.name = "UploadSaveValidationError";
    }
}

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
    if (!session?.user?.id || !session.user.email) {
        return NextResponse.json(
            { success: false, error: "You must be signed in to upload files." },
            { status: 401 },
        );
    }
    const userId = session.user.id;
    const userEmail = session.user.email;

    const rateLimit = await checkSlidingWindowRateLimit({
        identifier: userId,
        limit: SAVE_RATE_LIMIT,
        prefix: "upload-save",
        windowMs: SAVE_RATE_WINDOW_MS,
    });
    if (!rateLimit.success) {
        return NextResponse.json(
            { success: false, error: "You have saved several uploads recently. Try again later." },
            { status: 429 },
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

    const receiptIds = Array.isArray(body.results)
        ? body.results.map((result) =>
              isRecord(result) ? stringValue(result.receiptId) : "",
          )
        : [];
    if (
        receiptIds.length === 0 ||
        receiptIds.length > MAX_UPLOAD_BATCH ||
        receiptIds.some((receiptId) => !receiptId) ||
        new Set(receiptIds).size !== receiptIds.length
    ) {
        return NextResponse.json(
            { success: false, error: `Upload batches must contain 1-${MAX_UPLOAD_BATCH} valid receipts.` },
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
        const result = await db.transaction(async (transaction) => {
            const now = new Date();
            const consumed = await transaction
                .update(uploadResultReceipt)
                .set({ consumedAt: now })
                .where(
                    and(
                        inArray(uploadResultReceipt.id, receiptIds),
                        eq(uploadResultReceipt.userId, userId),
                        gt(uploadResultReceipt.expiresAt, now),
                        isNull(uploadResultReceipt.consumedAt),
                    ),
                )
                .returning({
                    id: uploadResultReceipt.id,
                    result: uploadResultReceipt.result,
                });
            if (consumed.length !== receiptIds.length) {
                throw new Error("One or more upload receipts are invalid, expired, or already used.");
            }
            const resultById = new Map(consumed.map((receipt) => [receipt.id, receipt.result]));
            const results = receiptIds.map((receiptId) => resultById.get(receiptId)!);

            const uploadResult = await createUploadedResources({
                userEmail,
                results,
                year: stringValue(body.year),
                slot: stringValue(body.slot),
                variant,
                courseId: nullableStringValue(body.courseId),
                examType,
                semester,
                campus,
                hasAnswerKey: body.hasAnswerKey === true,
                database: transaction,
            });

            if (!uploadResult.success) {
                throw new UploadSaveValidationError(uploadResult);
            }

            return uploadResult;
        });

        await runUploadedResourcePostSaveTasks(variant, result.data);

        return NextResponse.json({ success: true, count: result.data?.length ?? 0 });
    } catch (error) {
        if (error instanceof UploadSaveValidationError) {
            return NextResponse.json(error.result, { status: 400 });
        }

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
