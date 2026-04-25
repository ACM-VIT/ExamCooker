import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { examTypeLabel, examTypeToSlug, ALL_EXAM_TYPES } from "@/lib/examSlug";
import type { ExamType } from "@/prisma/generated/client";

export async function getCourseExamCombos() {
    const combos = await prisma.pastPaper.findMany({
        where: {
            isClear: true,
            courseId: { not: null },
            examType: { not: null },
        },
        select: {
            examType: true,
            course: { select: { code: true } },
        },
    });

    const seen = new Set<string>();
    return combos
        .flatMap((item) => {
            if (!item.course?.code || !item.examType) return [];
            const key = `${item.course.code}::${item.examType}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [{ code: item.course.code, examSlug: examTypeToSlug(item.examType) }];
        })
        .sort((a, b) => {
            const codeCompare = a.code.localeCompare(b.code, "en", { sensitivity: "base" });
            if (codeCompare !== 0) return codeCompare;
            return a.examSlug.localeCompare(b.examSlug, "en", { sensitivity: "base" });
        });
}

export async function getExamHubSummaries() {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await Promise.all(
        ALL_EXAM_TYPES.map(async (examType) => {
            const [paperCount, courseCount, latest] = await Promise.all([
                prisma.pastPaper.count({ where: { isClear: true, examType, courseId: { not: null } } }),
                prisma.course.count({ where: { papers: { some: { isClear: true, examType } } } }),
                prisma.pastPaper.findFirst({
                    where: { isClear: true, examType },
                    orderBy: [{ year: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
                    select: { year: true },
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
        where: { isClear: true, examType, courseId: { not: null } },
        _count: { _all: true },
        _max: { year: true },
    });

    const courseIds = grouped
        .map((row) => row.courseId)
        .filter((courseId): courseId is string => Boolean(courseId));

    if (courseIds.length === 0) return null;

    const [courses, recentPapers] = await Promise.all([
        prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: {
                id: true,
                code: true,
                title: true,
                aliases: true,
                _count: { select: { notes: { where: { isClear: true } } } },
            },
        }),
        prisma.pastPaper.findMany({
            where: { isClear: true, examType, courseId: { not: null } },
            orderBy: [{ year: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
            take: 18,
            select: {
                id: true,
                title: true,
                thumbNailUrl: true,
                year: true,
                course: { select: { code: true, title: true } },
            },
        }),
    ]);

    const byCourseId = new Map(
        grouped.map((row) => [row.courseId, { paperCount: row._count._all, latestYear: row._max.year }]),
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
            (course): course is NonNullable<typeof course> => Boolean(course),
        )
        .sort((a, b) => {
            if (b.paperCount !== a.paperCount) return b.paperCount - a.paperCount;
            if ((b.latestYear ?? 0) !== (a.latestYear ?? 0)) return (b.latestYear ?? 0) - (a.latestYear ?? 0);
            return a.title.localeCompare(b.title, "en", { sensitivity: "base" });
        });

    const totalPapers = courseRows.reduce((sum, c) => sum + c.paperCount, 0);
    const latestYear = courseRows.reduce<number | null>((max, c) => {
        if (c.latestYear === null) return max;
        if (max === null) return c.latestYear;
        return Math.max(max, c.latestYear);
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
