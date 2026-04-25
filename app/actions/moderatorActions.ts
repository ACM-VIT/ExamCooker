"use server";

import prisma from "@/lib/prisma";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";

export async function fetchUnclearedItems() {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const notes = await prisma.note.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
    });
    const pastPapers = await prisma.pastPaper.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
        include: { course: { select: { code: true, title: true } } },
    });

    const totalUsers = await prisma.user.count();

    return {
        notes: notes.map((note) => ({
            ...note,
            fileUrl: normalizeGcsUrl(note.fileUrl) ?? note.fileUrl,
            thumbNailUrl: normalizeGcsUrl(note.thumbNailUrl) ?? note.thumbNailUrl,
        })),
        pastPapers: pastPapers.map((paper) => ({
            ...paper,
            fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
            thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
        })),
        totalUsers,
    };
}

export async function approveItem(
    id: string,
    type: "note" | "pastPaper",
    options?: { allowDuplicate?: boolean },
) {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const allowDuplicate = options?.allowDuplicate ?? false;

    if (type === "note") {
        await prisma.note.update({ where: { id }, data: { isClear: true } });
    } else {
        const paper = await prisma.pastPaper.findUnique({
            where: { id },
            select: { title: true, fileUrl: true, courseId: true, examType: true, year: true },
        });
        if (!paper) throw new Error("Past paper not found");

        if (!allowDuplicate) {
            const fileDuplicate = await prisma.pastPaper.findFirst({
                where: { id: { not: id }, fileUrl: paper.fileUrl },
                select: { id: true, title: true },
            });
            if (fileDuplicate) {
                return {
                    status: "duplicate" as const,
                    duplicateId: fileDuplicate.id,
                    duplicateTitle: fileDuplicate.title,
                };
            }

            if (paper.courseId && paper.examType && paper.year) {
                const structuredDuplicate = await prisma.pastPaper.findFirst({
                    where: {
                        id: { not: id },
                        courseId: paper.courseId,
                        examType: paper.examType,
                        year: paper.year,
                    },
                    select: { id: true, title: true },
                });
                if (structuredDuplicate) {
                    return {
                        status: "duplicate" as const,
                        duplicateId: structuredDuplicate.id,
                        duplicateTitle: structuredDuplicate.title,
                    };
                }
            } else {
                const exactTitleDuplicate = await prisma.pastPaper.findFirst({
                    where: { id: { not: id }, title: { equals: paper.title, mode: "insensitive" } },
                    select: { id: true, title: true },
                });
                if (exactTitleDuplicate) {
                    return {
                        status: "duplicate" as const,
                        duplicateId: exactTitleDuplicate.id,
                        duplicateTitle: exactTitleDuplicate.title,
                    };
                }
            }
        }

        await prisma.pastPaper.update({ where: { id }, data: { isClear: true } });
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");

    return { status: "approved" as const };
}

export async function renameItem(id: string, type: "note" | "pastPaper", title: string) {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") await prisma.note.update({ where: { id }, data: { title } });
    if (type === "pastPaper") await prisma.pastPaper.update({ where: { id }, data: { title } });

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    if (type === "pastPaper") {
        revalidatePath(`/past_papers/${id}`);
        revalidateTag(`past_paper:${id}`, "minutes");
    }
}

export async function deleteItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") await prisma.note.delete({ where: { id } });
    if (type === "pastPaper") await prisma.pastPaper.delete({ where: { id } });

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
}

export async function generatePastPaperTitle(id: string) {
    const session = await auth();
    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const paper = await prisma.pastPaper.findUnique({
        where: { id },
        select: { title: true, fileUrl: true },
    });
    if (!paper) throw new Error("Past paper not found");

    const fileUrl = normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl;
    const aiTitle = await generatePastPaperTitleFromPdf({ fileUrl, fallbackTitle: paper.title });

    if (aiTitle && aiTitle !== paper.title) {
        await prisma.pastPaper.update({ where: { id }, data: { title: aiTitle } });
    }

    revalidatePath("/mod");
    revalidateTag("past_papers", "minutes");

    return { title: aiTitle };
}
