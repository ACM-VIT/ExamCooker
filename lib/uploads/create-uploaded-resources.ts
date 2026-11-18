import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { reviewUploadedResource } from "@/lib/ai/moderation-review";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import type { UploadResourceMetadata, UploadVariant } from "@/lib/uploads/upload-details";
import { db, note, pastPaper, user } from "@/db";

export const UPLOAD_SUCCESS_MESSAGE = "processed successfully";

export type { UploadResourceMetadata, UploadVariant } from "@/lib/uploads/upload-details";

export type ProcessedUploadResult = {
    fileUrl: string;
    thumbnailUrl?: string | null;
    filename: string;
    message: string;
};

type UploadTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A processed file and the details its resource is saved with. */
export type ClaimedUpload = {
    result: ProcessedUploadResult;
    metadata: UploadResourceMetadata;
};

export type CreateUploadedResourcesInput = {
    userEmail: string;
    /**
     * Reads the processed files inside the transaction that creates their
     * resources, so claiming a one-time receipt commits or rolls back with
     * them. Throw UploadRejectedError to reject the batch.
     */
    claimResults: (transaction: UploadTransaction) => Promise<ClaimedUpload[]>;
    variant: UploadVariant;
    /**
     * Runs automatic review for the batch when present. Without it the
     * resources stay unpublished in the moderator queue.
     */
    aiEnvironment?: object;
};

/** A batch that cannot be saved as sent; nothing in it was stored. */
export class UploadRejectedError extends Error {}

function normalizeOptionalUrl(url: string | null | undefined) {
    if (!url) {
        return null;
    }

    return normalizeGcsUrl(url) ?? url;
}

function assertSavableResults(results: ProcessedUploadResult[]) {
    const errors = results.filter((result) => result.message !== UPLOAD_SUCCESS_MESSAGE);
    if (errors.length > 0) {
        throw new UploadRejectedError(errors.map((error) => error.message).join(", "));
    }
    if (results.some((result) => !result.fileUrl || !result.filename)) {
        throw new UploadRejectedError(
            "Upload processor response was missing a file URL or filename.",
        );
    }
}

export async function createUploadedResources({
    userEmail,
    claimResults,
    variant,
    aiEnvironment,
}: CreateUploadedResourcesInput) {
    let data: { id: string; title: string; fileUrl: string }[];
    try {
        // One transaction: either every resource is created and its receipt
        // spent, or nothing is, and the client can retry the same receipts.
        data = await db.transaction(async (transaction) => {
            const [currentUser] = await transaction
                .select({ id: user.id })
                .from(user)
                .where(eq(user.email, userEmail))
                .limit(1);
            if (!currentUser) {
                throw new Error(`User with email ${userEmail} does not exist`);
            }

            const claimed = await claimResults(transaction);
            assertSavableResults(claimed.map(({ result }) => result));

            const created = [];
            for (const { result, metadata } of claimed) {
                const { courseId, examType, slot, semester, campus, hasAnswerKey } = metadata;
                const year = metadata.year ? parseInt(metadata.year, 10) : null;
                const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                const thumbNailUrl = normalizeOptionalUrl(result.thumbnailUrl);
                const [row] =
                    variant === "Notes"
                        ? await transaction
                              .insert(note)
                              .values({
                                  title: result.filename,
                                  fileUrl,
                                  ...(thumbNailUrl ? { thumbNailUrl } : {}),
                                  authorId: currentUser.id,
                                  ...(courseId ? { courseId } : {}),
                              })
                              .returning({
                                  id: note.id,
                                  title: note.title,
                                  fileUrl: note.fileUrl,
                              })
                        : await transaction
                              .insert(pastPaper)
                              .values({
                                  title: result.filename,
                                  fileUrl,
                                  ...(thumbNailUrl ? { thumbNailUrl } : {}),
                                  authorId: currentUser.id,
                                  ...(courseId ? { courseId } : {}),
                                  ...(examType ? { examType } : {}),
                                  ...(slot ? { slot } : {}),
                                  ...(year !== null && !Number.isNaN(year) ? { year } : {}),
                                  ...(semester ? { semester } : {}),
                                  ...(campus ? { campus } : {}),
                                  hasAnswerKey,
                              })
                              .returning({
                                  id: pastPaper.id,
                                  title: pastPaper.title,
                                  fileUrl: pastPaper.fileUrl,
                              });
                created.push(row);
            }
            return created;
        });
    } catch (error) {
        if (error instanceof UploadRejectedError) {
            return { success: false as const, error: error.message };
        }
        throw error;
    }

    revalidatePath("/mod");
    // New resources are unpublished (isClear defaults to false) until review
    // or a moderator approves them, so a skipped review leaves them queued.
    const autoReview = aiEnvironment !== undefined;
    if (aiEnvironment) {
        const type = variant === "Notes" ? "note" : "pastPaper";
        after(async () => {
            await mapWithConcurrency(data, 2, async ({ id }) => {
                try {
                    await reviewUploadedResource({ id, type, autoApprove: true, aiEnvironment });
                } catch (error) {
                    console.error(`Failed to review uploaded ${type} ${id}:`, error);
                }
            });
            try {
                revalidatePath("/mod");
                revalidateTag("notes", "minutes");
                revalidateTag("past_papers", "minutes");
                await invalidatePastPapersSurfaceCache();
            } catch (error) {
                console.error("Failed to run automatic upload moderation:", error);
            }
        });
    }

    if (variant === "Notes") {
        revalidatePath("/notes");
        revalidateTag("notes", "minutes");
        await invalidatePastPapersSurfaceCache();
    } else {
        revalidatePath("/mod/papers/review");
        revalidatePath("/past_papers");
        revalidateTag("past_papers", "minutes");
        await invalidatePastPapersSurfaceCache();
    }

    return { success: true as const, data, autoReview };
}
