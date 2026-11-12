import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { reviewUploadedResource } from "@/lib/ai/moderation-review";
import { mapWithConcurrency } from "@/lib/async/map-with-concurrency";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import type {
    Campus,
    ExamType,
    Semester,
} from "@/db";
import { db, note, pastPaper, user } from "@/db";

export const UPLOAD_SUCCESS_MESSAGE = "processed successfully";

export type UploadVariant = "Notes" | "Past Papers";

export type ProcessedUploadResult = {
    fileUrl: string;
    thumbnailUrl?: string | null;
    filename: string;
    message: string;
};

type UploadTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateUploadedResourcesInput = {
    userEmail: string;
    /**
     * Reads the processed files inside the transaction that creates their
     * resources, so claiming a one-time receipt commits or rolls back with
     * them. Throw UploadRejectedError to reject the batch.
     */
    claimResults: (transaction: UploadTransaction) => Promise<ProcessedUploadResult[]>;
    year: string;
    slot: string;
    variant: UploadVariant;
    courseId?: string | null;
    examType?: string | null;
    semester?: string | null;
    campus?: string | null;
    hasAnswerKey?: boolean;
    autoReview?: boolean;
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
    year,
    slot,
    variant,
    courseId,
    examType,
    semester,
    campus,
    hasAnswerKey,
    autoReview = true,
    aiEnvironment,
}: CreateUploadedResourcesInput) {
    const yearInt = year ? parseInt(year, 10) : null;
    const parsedExamType = examType as ExamType | null | undefined;
    const parsedSemester = semester as Semester | null | undefined;
    const parsedCampus = campus as Campus | null | undefined;

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

            const results = await claimResults(transaction);
            assertSavableResults(results);

            const created = [];
            for (const result of results) {
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
                                  ...(parsedExamType ? { examType: parsedExamType } : {}),
                                  ...(slot ? { slot } : {}),
                                  ...(yearInt !== null && !Number.isNaN(yearInt)
                                      ? { year: yearInt }
                                      : {}),
                                  ...(parsedSemester ? { semester: parsedSemester } : {}),
                                  ...(parsedCampus ? { campus: parsedCampus } : {}),
                                  hasAnswerKey: hasAnswerKey ?? false,
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
    if (autoReview) {
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

    return { success: true as const, data };
}
