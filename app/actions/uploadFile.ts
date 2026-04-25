"use server";

import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";

export default async function uploadFile({
    results,
    year,
    slot,
    variant,
    courseId,
    examType,
    semester,
    campus,
    hasAnswerKey,
}: {
    results: {
        fileUrl: string;
        thumbnailUrl: string;
        filename: string;
        message: string;
    }[];
    year: string;
    slot: string;
    variant: "Notes" | "Past Papers";
    courseId?: string | null;
    examType?: string | null;
    semester?: string | null;
    campus?: string | null;
    hasAnswerKey?: boolean;
}) {
    const session = await auth();
    if (!session || !session.user) {
        redirect("/landing");
    }
    const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
    });

    if (!user) {
        throw new Error(`User with ID ${session?.user?.email} does not exist`);
    }

    const errors = results.filter((r) => r.message !== "processed successfully");
    if (errors.length > 0) {
        return { success: false, error: errors.map((e) => e.message).join(", ") };
    }

    const yearInt = year ? parseInt(year, 10) : null;
    const parsedExamType = examType as import("@/prisma/generated/client").ExamType | null | undefined;
    const parsedSemester = semester as import("@/prisma/generated/client").Semester | null | undefined;
    const parsedCampus = campus as import("@/prisma/generated/client").Campus | null | undefined;

    const promises =
        variant === "Notes"
            ? results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl = normalizeGcsUrl(result.thumbnailUrl) ?? result.thumbnailUrl;
                  return prisma.note.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          thumbNailUrl,
                          authorId: user.id,
                          ...(courseId ? { courseId } : {}),
                      },
                  });
              })
            : results.map((result) => {
                  const fileUrl = normalizeGcsUrl(result.fileUrl) ?? result.fileUrl;
                  const thumbNailUrl = normalizeGcsUrl(result.thumbnailUrl) ?? result.thumbnailUrl;
                  return prisma.pastPaper.create({
                      data: {
                          title: result.filename,
                          fileUrl,
                          thumbNailUrl,
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

    return { success: true, data };
}
