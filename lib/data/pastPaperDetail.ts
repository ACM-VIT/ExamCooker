import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type { ExamType } from "@/prisma/generated/client";

export async function getPastPaperDetail(id: string) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const paper = await prisma.pastPaper.findUnique({
        where: { id },
        include: {
            author: true,
            tags: true,
            course: {
                select: {
                    code: true,
                    title: true,
                },
            },
        },
    });

    if (!paper) return null;

    return {
        ...paper,
        fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
    };
}

export async function getAdjacentPapersInCourse(input: {
    paperId: string;
    courseId: string;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const papers = await prisma.pastPaper.findMany({
        where: {
            courseId: input.courseId,
            isClear: true,
        },
        orderBy: [
            { year: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
        ],
        select: {
            id: true,
            year: true,
            examType: true,
            slot: true,
            course: { select: { code: true } },
        },
    });

    const index = papers.findIndex((p) => p.id === input.paperId);
    if (index === -1) return { prev: null, next: null };

    return {
        prev: index > 0 ? papers[index - 1] : null,
        next: index < papers.length - 1 ? papers[index + 1] : null,
    };
}

export async function getRelatedPapersForCourse(input: {
    paperId: string;
    courseId: string;
    examType?: ExamType | null;
    limit?: number;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const papers = await prisma.pastPaper.findMany({
        where: {
            id: { not: input.paperId },
            courseId: input.courseId,
            isClear: true,
            ...(input.examType ? { examType: input.examType } : {}),
        },
        orderBy: [
            { year: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
        ],
        take: input.limit ?? 6,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            examType: true,
            slot: true,
            year: true,
            course: { select: { code: true, title: true } },
        },
    });

    return papers.map((p) => ({
        ...p,
        thumbNailUrl: normalizeGcsUrl(p.thumbNailUrl) ?? p.thumbNailUrl,
    }));
}
