"use server";

import { PrismaClient } from "@/src/generated/prisma";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/pastPaperTitle";
import { parsePaperTitle } from "@/lib/paperTitle";
import { normalizeCourseCode } from "@/lib/courseTags";

const prisma = new PrismaClient();

export async function fetchUnclearedItems() {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const notes = await prisma.note.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
    });
    const pastPapers = await prisma.pastPaper.findMany({
        where: { isClear: false },
        orderBy: { createdAt: "desc" },
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
    options?: { allowDuplicate?: boolean }
) {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const allowDuplicate = options?.allowDuplicate ?? false;

    if (type === "note") {
        await prisma.note.update({ where: { id }, data: { isClear: true } });
    } else {
        const paper = await prisma.pastPaper.findUnique({
            where: { id },
            select: { title: true, fileUrl: true },
        });

        if (!paper) {
            throw new Error("Past paper not found");
        }

        if (!allowDuplicate) {
            const fileDuplicate = await prisma.pastPaper.findFirst({
                where: {
                    id: { not: id },
                    fileUrl: paper.fileUrl,
                },
                select: { id: true, title: true },
            });

            if (fileDuplicate) {
                return {
                    status: "duplicate" as const,
                    duplicateId: fileDuplicate.id,
                    duplicateTitle: fileDuplicate.title,
                };
            }

            const parsed = parsePaperTitle(paper.title);
            const normalizedCode = parsed.courseCode
                ? normalizeCourseCode(parsed.courseCode)
                : null;
            const normalizedTitle = paper.title.trim().toLowerCase();

            if (normalizedCode) {
                const candidates = await prisma.pastPaper.findMany({
                    where: {
                        id: { not: id },
                        OR: [
                            { title: { contains: normalizedCode, mode: "insensitive" } },
                            { tags: { some: { name: { contains: normalizedCode, mode: "insensitive" } } } },
                        ],
                    },
                    select: { id: true, title: true },
                    take: 50,
                });

                const targetRange = getYearRange(parsed);

                for (const candidate of candidates) {
                    const candidateParsed = parsePaperTitle(candidate.title);
                    const candidateCode = candidateParsed.courseCode
                        ? normalizeCourseCode(candidateParsed.courseCode)
                        : null;
                    if (!candidateCode || candidateCode !== normalizedCode) continue;

                    if (
                        !isMetadataCompatible(parsed.examType, candidateParsed.examType) ||
                        !isMetadataCompatible(parsed.slot, candidateParsed.slot)
                    ) {
                        continue;
                    }

                    const candidateRange = getYearRange(candidateParsed);
                    if (!rangesOverlap(targetRange, candidateRange)) {
                        continue;
                    }

                    if (candidate.title.trim().toLowerCase() === normalizedTitle) {
                        return {
                            status: "duplicate" as const,
                            duplicateId: candidate.id,
                            duplicateTitle: candidate.title,
                        };
                    }

                    return {
                        status: "duplicate" as const,
                        duplicateId: candidate.id,
                        duplicateTitle: candidate.title,
                    };
                }
            } else {
                const exactTitleDuplicate = await prisma.pastPaper.findFirst({
                    where: {
                        id: { not: id },
                        title: { equals: paper.title, mode: "insensitive" },
                    },
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

        await prisma.pastPaper.update({
            where: { id },
            data: { isClear: true },
        });
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");

    return { status: "approved" as const };
}

function getYearRange(parsed: ReturnType<typeof parsePaperTitle>) {
    if (parsed.academicYear) {
        const [start, end] = parsed.academicYear.split("-").map((value) => Number(value));
        if (Number.isFinite(start) && Number.isFinite(end)) {
            return { start, end };
        }
    }

    if (parsed.year) {
        const year = Number(parsed.year);
        if (Number.isFinite(year)) {
            return { start: year, end: year };
        }
    }

    return null;
}

function rangesOverlap(
    a: { start: number; end: number } | null,
    b: { start: number; end: number } | null
) {
    if (!a || !b) return true;
    return a.start <= b.end && b.start <= a.end;
}

function isMetadataCompatible(a?: string, b?: string) {
    if (!a || !b) return true;
    return a.toUpperCase() === b.toUpperCase();
}

export async function renameItem(
    id: string,
    type: "note" | "pastPaper",
    title: string
) {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    if (type === "note") {
        await prisma.note.update({ where: { id }, data: { title } });
    }

    if (type === "pastPaper") {
        await prisma.pastPaper.update({ where: { id }, data: { title } });
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
}

export async function deleteItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    if (type === "note") {
        await prisma.note.delete({ where: { id } });
    }

    if (type === "pastPaper") {
        await prisma.pastPaper.delete({ where: { id } });
    }
    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
}

export async function generatePastPaperTitle(id: string) {
    const session = await auth();

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const paper = await prisma.pastPaper.findUnique({
        where: { id },
        select: { title: true, fileUrl: true },
    });

    if (!paper) {
        throw new Error("Past paper not found");
    }

    const fileUrl = normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl;
    const aiTitle = await generatePastPaperTitleFromPdf({
        fileUrl,
        fallbackTitle: paper.title,
    });

    if (aiTitle && aiTitle !== paper.title) {
        await prisma.pastPaper.update({
            where: { id },
            data: { title: aiTitle },
        });
    }

    revalidatePath("/mod");
    revalidateTag("past_papers", "minutes");

    return { title: aiTitle };
}
