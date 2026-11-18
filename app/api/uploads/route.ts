import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { auth } from "@/app/auth";
import {
    createUploadedResources,
    UploadRejectedError,
    type UploadVariant,
} from "@/lib/uploads/create-uploaded-resources";
import { uploadResultReceipt } from "@/db";
import { checkSlidingWindowRateLimit } from "@/lib/redis-rate-limit";
import { readAiSession } from "@/lib/ai/session";
import { parseUploadBatch } from "@/lib/uploads/upload-details";
import { getUploadReviewEnvironment } from "@/lib/uploads/upload-review-environment";

const MAX_UPLOAD_BATCH = 8;
const SAVE_RATE_LIMIT = 12;
const SAVE_RATE_WINDOW_MS = 60 * 60 * 1000;
const uploadVariants = new Set<UploadVariant>(["Notes", "Past Papers"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
        return NextResponse.json(
            { success: false, error: "You must be signed in to upload files." },
            { status: 401 },
        );
    }

    let body: unknown;
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

    const batch = parseUploadBatch(body, variant, MAX_UPLOAD_BATCH);
    if (batch.error !== undefined) {
        return NextResponse.json(
            { success: false, error: batch.error },
            { status: 400 },
        );
    }
    const receiptIds = batch.items.map((item) => item.receiptId);

    // Count only requests that could save something, so a malformed retry
    // does not use up the hour's allowance.
    const rateLimit = await checkSlidingWindowRateLimit({
        identifier: session.user.id,
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

    try {
        const aiEnvironment = getUploadReviewEnvironment(
            process.env,
            await readAiSession(session.user.id),
        );
        const result = await createUploadedResources({
            userEmail: session.user.email,
            claimResults: async (transaction) => {
                const now = new Date();
                const consumed = await transaction
                    .update(uploadResultReceipt)
                    .set({ consumedAt: now })
                    .where(
                        and(
                            inArray(uploadResultReceipt.id, receiptIds),
                            eq(uploadResultReceipt.userId, session.user.id),
                            gt(uploadResultReceipt.expiresAt, now),
                            isNull(uploadResultReceipt.consumedAt),
                        ),
                    )
                    .returning({
                        id: uploadResultReceipt.id,
                        result: uploadResultReceipt.result,
                    });
                if (consumed.length !== receiptIds.length) {
                    throw new UploadRejectedError(
                        "One or more upload receipts are invalid, expired, or already used.",
                    );
                }
                const resultById = new Map(
                    consumed.map((receipt) => [receipt.id, receipt.result]),
                );
                return batch.items.map(({ receiptId, metadata }) => ({
                    result: resultById.get(receiptId)!,
                    metadata,
                }));
            },
            variant,
            aiEnvironment,
        });

        if (!result.success) {
            return NextResponse.json(result, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            count: result.data.length,
            autoReview: result.autoReview,
        });
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
