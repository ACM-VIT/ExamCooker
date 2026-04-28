import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";
import type {
    Campus,
    ExamType,
    Semester,
} from "@/src/db";
import { db, note, pastPaper, user } from "@/src/db";

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
};

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
}: CreateUploadedResourcesInput) {
    const userRows = await db
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
                      const rows = await db
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
                      const rows = await db
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

    if (variant === "Past Papers") {
        const createdPapers = data as { id: string; title: string; fileUrl: string }[];
        after(async () => {
            try {
                await Promise.allSettled(
                    createdPapers.map(async (paper) => {
                        const aiTitle = await generatePastPaperTitleFromPdf({
                            fileUrl: paper.fileUrl,
                            fallbackTitle: paper.title,
                        });
                        if (aiTitle && aiTitle !== paper.title) {
                            await db
                                .update(pastPaper)
                                .set({ title: aiTitle })
                                .where(eq(pastPaper.id, paper.id));
                        }
                    }),
                );
                revalidateTag("past_papers", "minutes");
            } catch (error) {
                console.error("Failed to post-process uploaded past papers:", error);
            }
        });
    }

    if (variant === "Notes") {
        revalidatePath("/notes");
        revalidateTag("notes", "minutes");
    } else {
        revalidatePath("/past_papers");
        revalidateTag("past_papers", "minutes");
    }

    return { success: true as const, data };
}
