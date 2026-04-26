import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";
import type {
    Campus,
    ExamType,
    Semester,
} from "@/prisma/generated/client";

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
    const user = await prisma.user.findUnique({
        where: { email: userEmail },
    });

    if (!user) {
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

    const promises =
        variant === "Notes"
            ? results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl = normalizeOptionalUrl(result.thumbnailUrl);
                  return prisma.note.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          ...(thumbNailUrl ? { thumbNailUrl } : {}),
                          authorId: user.id,
                          ...(courseId ? { courseId } : {}),
                      },
                  });
              })
            : results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl = normalizeOptionalUrl(result.thumbnailUrl);
                  return prisma.pastPaper.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          ...(thumbNailUrl ? { thumbNailUrl } : {}),
                          authorId: user.id,
                          ...(courseId ? { courseId } : {}),
                          ...(parsedExamType ? { examType: parsedExamType } : {}),
                          ...(slot ? { slot } : {}),
                          ...(yearInt !== null && !Number.isNaN(yearInt) ? { year: yearInt } : {}),
                          ...(parsedSemester ? { semester: parsedSemester } : {}),
                          ...(parsedCampus ? { campus: parsedCampus } : {}),
                          hasAnswerKey: hasAnswerKey ?? false,
                      },
                  });
              });

    const data = await Promise.all(promises);

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
                            await prisma.pastPaper.update({
                                where: { id: paper.id },
                                data: { title: aiTitle },
                            });
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
