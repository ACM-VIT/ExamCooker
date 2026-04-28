import { cacheLife, cacheTag } from "next/cache";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import { examTypeLabel, examTypeToSlug } from "@/lib/examSlug";
import {
    course,
    db,
    type ExamType,
    note,
    pastPaper,
} from "@/src/db";

export async function getCourseExamCombos() {
    const combos = await db
        .selectDistinct({
            examType: pastPaper.examType,
            courseCode: course.code,
        })
        .from(pastPaper)
        .innerJoin(course, eq(pastPaper.courseId, course.id))
        .where(
            and(
                eq(pastPaper.isClear, true),
                isNotNull(pastPaper.courseId),
                isNotNull(pastPaper.examType),
            ),
        );

    return combos
        .flatMap((item) => {
            if (!item.courseCode || !item.examType) return [];
            return [{ code: item.courseCode, examSlug: examTypeToSlug(item.examType) }];
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

    const rows = await db
        .select({
            examType: pastPaper.examType,
            paperCount: count(),
            courseCount: sql<number>`count(distinct ${pastPaper.courseId})`,
            latestYear: sql<number | null>`max(${pastPaper.year})`,
        })
        .from(pastPaper)
        .where(
            and(
                eq(pastPaper.isClear, true),
                isNotNull(pastPaper.courseId),
                isNotNull(pastPaper.examType),
            ),
        )
        .groupBy(pastPaper.examType);

    return rows
        .flatMap((row) => {
            if (!row.examType || !row.paperCount || !row.courseCount) {
                return [];
            }

            return [{
                examType: row.examType,
                slug: examTypeToSlug(row.examType),
                label: examTypeLabel(row.examType),
                paperCount: row.paperCount,
                courseCount: Number(row.courseCount),
                latestYear: row.latestYear ?? null,
            }];
        })
        .sort((a, b) => b.paperCount - a.paperCount);
}

export async function getExamHubPageData(examType: ExamType) {
    "use cache";
    cacheTag("past_papers");
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const grouped = await db
        .select({
            courseId: pastPaper.courseId,
            paperCount: count(),
            latestYear: sql<number | null>`max(${pastPaper.year})`,
        })
        .from(pastPaper)
        .where(
            and(
                eq(pastPaper.isClear, true),
                eq(pastPaper.examType, examType),
                isNotNull(pastPaper.courseId),
            ),
        )
        .groupBy(pastPaper.courseId);

    const courseIds = grouped
        .map((row) => row.courseId)
        .filter((courseId): courseId is string => Boolean(courseId));

    if (courseIds.length === 0) return null;

    const [courses, noteCounts, recentPapers] = await Promise.all([
        db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
            })
            .from(course)
            .where(inArray(course.id, courseIds)),
        db
            .select({
                courseId: note.courseId,
                noteCount: count(),
            })
            .from(note)
            .where(
                and(
                    eq(note.isClear, true),
                    isNotNull(note.courseId),
                    inArray(note.courseId, courseIds),
                ),
            )
            .groupBy(note.courseId),
        db
            .select({
                id: pastPaper.id,
                title: pastPaper.title,
                thumbNailUrl: pastPaper.thumbNailUrl,
                year: pastPaper.year,
                courseCode: course.code,
                courseTitle: course.title,
            })
            .from(pastPaper)
            .innerJoin(course, eq(pastPaper.courseId, course.id))
            .where(
                and(
                    eq(pastPaper.isClear, true),
                    eq(pastPaper.examType, examType),
                    isNotNull(pastPaper.courseId),
                ),
            )
            .orderBy(sql`${pastPaper.year} desc nulls last`, desc(pastPaper.createdAt))
            .limit(18),
    ]);

    const byCourseId = new Map(
        grouped
            .filter((row) => row.courseId !== null)
            .map((row) => [row.courseId, { paperCount: row.paperCount, latestYear: row.latestYear }]),
    );
    const noteCountByCourseId = new Map(
        noteCounts
            .filter((row) => row.courseId !== null)
            .map((row) => [row.courseId, row.noteCount]),
    );

    const courseRows = courses
        .map((course) => {
            const stats = byCourseId.get(course.id);
            if (!stats) return null;
            return {
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases ?? [],
                paperCount: stats.paperCount,
                noteCount: noteCountByCourseId.get(course.id) ?? 0,
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
            courseCode: paper.courseCode ?? null,
            courseTitle: paper.courseTitle ?? null,
            year: paper.year,
            examType,
        })),
    };
}
