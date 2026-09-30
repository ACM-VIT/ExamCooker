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

export type CreateUploadedResourcesInput = {
    userEmail: string;
    results: ProcessedUploadResult[];
    year: string;
    slot: string;
    variant: UploadVariant;
    courseId?: string | null;
    examType?: string | null;
    semester?: string | null;
    campus?: string | null;
    hasAnswerKey?: boolean;
    dbClient?: UploadResourceDbClient;
};

type UploadResourceDbClient = Pick<typeof db, "insert" | "select">;

function normalizeOptionalUrl(url: string | null | undefined) {
    if (!url) {
        return null;
    }

    return normalizeGcsUrl(url) ?? url;
}

export async function createUploadedResources({
    userEmail,
    results,
    year,
    slot,
    variant,
    courseId,
    examType,
    semester,
    campus,
    hasAnswerKey,
    dbClient = db,
}: CreateUploadedResourcesInput) {
    const userRows = await dbClient
        .select({
            id: user.id,
        })
        .from(user)
        .where(eq(user.email, userEmail))
        .limit(1);

    const currentUser = userRows[0];

    if (!currentUser) {
        throw new Error(`User with email ${userEmail} does not exist`);
    }

    const errors = results.filter((result) => result.message !== UPLOAD_SUCCESS_MESSAGE);
    if (errors.length > 0) {
        return {
            success: false as const,
            error: errors.map((error) => error.message).join(", "),
        };
    }

    const missingRequiredFields = results.find(
        (result) => !result.fileUrl || !result.filename,
    );
    if (missingRequiredFields) {
        return {
            success: false as const,
            error: "Upload processor response was missing a file URL or filename.",
        };
    }

    const yearInt = year ? parseInt(year, 10) : null;
    const parsedExamType = examType as ExamType | null | undefined;
    const parsedSemester = semester as Semester | null | undefined;
    const parsedCampus = campus as Campus | null | undefined;

    const data =
        variant === "Notes"
            ? await Promise.all(
                  results.map(async (result) => {
                      const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                      const thumbNailUrl = normalizeOptionalUrl(result.thumbnailUrl);
                      const rows = await dbClient
                          .insert(note)
                          .values({
                              title: result.filename,
                              fileUrl,
                              ...(thumbNailUrl ? { thumbNailUrl } : {}),
                              authorId: currentUser.id,
                              ...(courseId ? { courseId } : {}),
                          })
                          .returning();

                      return rows[0];
                  }),
              )
            : await Promise.all(
                  results.map(async (result) => {
                      const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                      const thumbNailUrl = normalizeOptionalUrl(result.thumbnailUrl);
                      const rows = await dbClient
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

                      return rows[0];
                  }),
              );

    const uploadedType = variant === "Notes" ? ("note" as const) : ("pastPaper" as const);
    const createdResources = data.map((resource) => ({
        id: resource.id,
        type: uploadedType,
    }));
    after(async () => {
        await mapWithConcurrency(createdResources, 2, async (resource) => {
            try {
                await reviewUploadedResource({ ...resource, autoApprove: true });
            } catch (error) {
                console.error(
                    `Failed to review uploaded ${resource.type} ${resource.id}:`,
                    error,
                );
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

    if (variant === "Notes") {
        revalidatePath("/notes");
        revalidateTag("notes", "minutes");
        await invalidatePastPapersSurfaceCache();
    } else {
        revalidatePath("/past_papers");
        revalidateTag("past_papers", "minutes");
        await invalidatePastPapersSurfaceCache();
    }

    return { success: true as const, data };
}
