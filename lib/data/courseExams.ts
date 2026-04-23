import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import {
    EXAM_TYPES,
    buildExamTitleWhere,
    getExamTypeBySlug,
} from "@/lib/examTypes";
import { examTypeLabel, examTypeToSlug, ALL_EXAM_TYPES } from "@/lib/examSlug";
import type { ExamType } from "@/prisma/generated/client";

export async function getCourseExamCounts(input: {
    tagIds: string[];
    courseId?: string | null;
}) {
    "use cache";
    if (!input.tagIds.length && !input.courseId) return [];
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const counts = await Promise.all(
        EXAM_TYPES.map(async (examType) => {
            const count = await prisma.pastPaper.count({
                where: {
                    isClear: true,
                    OR: [
                        ...(input.courseId ? [{ courseId: input.courseId }] : []),
                        ...(input.tagIds.length
                            ? [{ tags: { some: { id: { in: input.tagIds } } } }]
                            : []),
                    ],
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

    const combos = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            courseId: { not: null },
            examType: { not: null },
        },
        select: {
            examType: true,
            course: {
                select: {
                    code: true,
                },
            },
        },
    });

    const seen = new Set<string>();
    const normalized = combos
        .flatMap((item) => {
            if (!item.course?.code || !item.examType) return [];
            const key = `${item.course.code}::${item.examType}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [
                {
                    code: item.course.code,
                    examSlug: examTypeToSlug(item.examType),
                },
            ];
        })
        .sort((a, b) => {
            const codeCompare = a.code.localeCompare(b.code, "en", {
                sensitivity: "base",
            });
            if (codeCompare !== 0) return codeCompare;
            return a.examSlug.localeCompare(b.examSlug, "en", {
                sensitivity: "base",
            });
        });

    return normalized;
}

export async function getExamHubSummaries() {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await Promise.all(
        ALL_EXAM_TYPES.map(async (examType) => {
            const [paperCount, courseCount, latest] = await Promise.all([
                prisma.pastPaper.count({
                    where: {
                        isClear: true,
                        examType,
                        courseId: { not: null },
                    },
                }),
                prisma.course.count({
                    where: {
                        papers: {
                            some: {
                                isClear: true,
                                examType,
                            },
                        },
                    },
                }),
                prisma.pastPaper.findFirst({
                    where: {
                        isClear: true,
                        examType,
                    },
                    orderBy: [
                        { year: { sort: "desc", nulls: "last" } },
                        { createdAt: "desc" },
                    ],
                    select: {
                        year: true,
                    },
                }),
            ]);

            if (!paperCount || !courseCount) return null;

            return {
                examType,
                slug: examTypeToSlug(examType),
                label: examTypeLabel(examType),
                paperCount,
                courseCount,
                latestYear: latest?.year ?? null,
            };
        }),
    );

    return rows
        .filter((row): row is NonNullable<(typeof rows)[number]> => Boolean(row))
        .sort((a, b) => b.paperCount - a.paperCount);
}

export async function getExamHubPageData(examType: ExamType) {
    "use cache";
    cacheTag("past_papers");
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const grouped = await prisma.pastPaper.groupBy({
        by: ["courseId"],
        where: {
            isClear: true,
            examType,
            courseId: { not: null },
        },
        _count: {
            _all: true,
        },
        _max: {
            year: true,
        },
    });

    const courseIds = grouped
        .map((row) => row.courseId)
        .filter((courseId): courseId is string => Boolean(courseId));

    if (courseIds.length === 0) {
        return null;
    }

    const [courses, recentPapers] = await Promise.all([
        prisma.course.findMany({
            where: {
                id: {
                    in: courseIds,
                },
            },
            select: {
                id: true,
                code: true,
                title: true,
                aliases: true,
                _count: {
                    select: {
                        notes: {
                            where: {
                                isClear: true,
                            },
                        },
                    },
                },
            },
        }),
        prisma.pastPaper.findMany({
            where: {
                isClear: true,
                examType,
                courseId: { not: null },
            },
            orderBy: [
                { year: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
            ],
            take: 18,
            select: {
                id: true,
                title: true,
                thumbNailUrl: true,
                year: true,
                course: {
                    select: {
                        code: true,
                        title: true,
                    },
                },
            },
        }),
    ]);

    const byCourseId = new Map(
        grouped.map((row) => [
            row.courseId,
            {
                paperCount: row._count._all,
                latestYear: row._max.year,
            },
        ]),
    );

    const courseRows = courses
        .map((course) => {
            const stats = byCourseId.get(course.id);
            if (!stats) return null;

            return {
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
                paperCount: stats.paperCount,
                noteCount: course._count.notes,
                latestYear: stats.latestYear ?? null,
            };
        })
        .filter(
            (
                course,
            ): course is {
                id: string;
                code: string;
                title: string;
                aliases: string[];
                paperCount: number;
                noteCount: number;
                latestYear: number | null;
            } => Boolean(course),
        )
        .sort((a, b) => {
            if (b.paperCount !== a.paperCount) return b.paperCount - a.paperCount;
            if ((b.latestYear ?? 0) !== (a.latestYear ?? 0)) {
                return (b.latestYear ?? 0) - (a.latestYear ?? 0);
            }
            return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
        });

    const totalPapers = courseRows.reduce((sum, course) => sum + course.paperCount, 0);
    const latestYear = courseRows.reduce<number | null>((maxYear, course) => {
        if (course.latestYear === null) return maxYear;
        if (maxYear === null) return course.latestYear;
        return Math.max(maxYear, course.latestYear);
    }, null);

    return {
        examType,
        slug: examTypeToSlug(examType),
        label: examTypeLabel(examType),
        totalPapers,
        courseCount: courseRows.length,
        latestYear,
        courses: courseRows,
        recentPapers: recentPapers.map((paper) => ({
            id: paper.id,
            title: paper.title,
            thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
            courseCode: paper.course?.code ?? null,
            courseTitle: paper.course?.title ?? null,
            year: paper.year,
            examType,
        })),
    };
}
