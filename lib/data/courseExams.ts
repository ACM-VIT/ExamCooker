import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { extractCourseFromTag } from "@/lib/courseTags";
import {
    EXAM_TYPES,
    buildExamTitleWhere,
    getExamTypeBySlug,
    matchExamTypeFromTitle,
} from "@/lib/examTypes";

export async function getCourseExamCounts(tagIds: string[]) {
    "use cache";
    if (!tagIds.length) return [];
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const counts = await Promise.all(
        EXAM_TYPES.map(async (examType) => {
            const count = await prisma.pastPaper.count({
                where: {
                    isClear: true,
                    tags: { some: { id: { in: tagIds } } },
                    ...buildExamTitleWhere(examType),
                },
            });
            return {
                slug: examType.slug,
                label: examType.label,
                count,
            };
        })
    );

    return counts.filter((entry) => entry.count > 0);
}

export async function getCourseExamPapers(input: {
    tagIds: string[];
    examSlug: string;
    limit?: number;
}) {
    "use cache";
    if (!input.tagIds.length) return [];
    const examType = getExamTypeBySlug(input.examSlug);
    if (!examType) return [];

    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const papers = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            tags: { some: { id: { in: input.tagIds } } },
            ...buildExamTitleWhere(examType),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
        },
    });

    return papers.map((paper) => ({
        ...paper,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
    }));
}

export async function getCourseExamCombos() {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const papers = await prisma.pastPaper.findMany({
        where: { isClear: true },
        select: {
            title: true,
            tags: { select: { name: true } },
        },
    });

    const combos = new Set<string>();

    for (const paper of papers) {
        const examType = matchExamTypeFromTitle(paper.title);
        if (!examType) continue;
        for (const tag of paper.tags) {
            const course = extractCourseFromTag(tag.name);
            if (!course) continue;
            combos.add(`${course.code}::${examType.slug}`);
        }
    }

    return Array.from(combos).map((entry) => {
        const [code, examSlug] = entry.split("::");
        return { code, examSlug };
    });
}
