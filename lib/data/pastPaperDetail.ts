import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type { Campus, ExamType, Semester } from "@/prisma/generated/client";

function normalizePaperLinkSummary<T extends {
    id: string;
    title: string;
    hasAnswerKey: boolean;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    course?: { code: string; title: string } | null;
}>(paper: T) {
    return {
        ...paper,
        title: paper.title,
    };
}

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

export async function getSiblingPastPaper(input: {
    paperId: string;
    questionPaperId: string | null;
    courseId: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    semester: Semester;
    campus: Campus;
    hasAnswerKey: boolean;
}) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${input.paperId}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const select = {
        id: true,
        title: true,
        hasAnswerKey: true,
        examType: true,
        slot: true,
        year: true,
        course: {
            select: {
                code: true,
                title: true,
            },
        },
    } as const;

    if (input.hasAnswerKey && input.questionPaperId) {
        const linkedQuestionPaper = await prisma.pastPaper.findUnique({
            where: { id: input.questionPaperId },
            select,
        });
        if (linkedQuestionPaper) return normalizePaperLinkSummary(linkedQuestionPaper);
    }

    const linkedAnswerKey = await prisma.pastPaper.findFirst({
        where: {
            questionPaperId: input.paperId,
            id: { not: input.paperId },
            isClear: true,
        },
        select,
        orderBy: { createdAt: "desc" },
    });
    if (linkedAnswerKey) return normalizePaperLinkSummary(linkedAnswerKey);

    if (!input.courseId || !input.examType || !input.slot || input.year === null) {
        return null;
    }

    const metadataSibling = await prisma.pastPaper.findFirst({
        where: {
            id: { not: input.paperId },
            courseId: input.courseId,
            examType: input.examType,
            slot: input.slot,
            year: input.year,
            semester: input.semester,
            campus: input.campus,
            hasAnswerKey: !input.hasAnswerKey,
            isClear: true,
        },
        select,
        orderBy: { createdAt: "desc" },
    });

    return metadataSibling ? normalizePaperLinkSummary(metadataSibling) : null;
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
