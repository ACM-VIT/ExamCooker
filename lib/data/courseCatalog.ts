import { cacheLife, cacheTag } from "next/cache";
import Fuse from "fuse.js";
import { cache } from "react";
import {
    and,
    count,
    desc,
    eq,
    inArray,
    isNotNull,
    sql,
} from "drizzle-orm";
import { normalizeCourseCode } from "@/lib/courseTags";
import { course, db, note, pastPaper, syllabi, viewHistory } from "@/src/db";

type CatalogStats = {
    courseCount: number;
    paperCount: number;
    noteCount: number;
};

const STATIC_CATALOG_STATS: CatalogStats = {
    courseCount: 474,
    paperCount: 3153,
    noteCount: 564,
};

export type CourseGridItem = {
    id: string;
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
    viewCount: number;
};

export type CourseDetail = {
    id: string;
    code: string;
    title: string;
    aliases: string[];
    paperCount: number;
    noteCount: number;
};

type CourseCatalogRow = {
    id: string;
    code: string;
    title: string;
    aliases: string[];
    paperCount: number;
    noteCount: number;
};

const getCourseCatalogRows = cache(async (): Promise<CourseCatalogRow[]> => {
    const [courses, noteCounts, paperCounts] = await Promise.all([
        db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
            })
            .from(course),
        db
            .select({
                courseId: note.courseId,
                noteCount: count(),
            })
            .from(note)
            .where(and(eq(note.isClear, true), isNotNull(note.courseId)))
            .groupBy(note.courseId),
        db
            .select({
                courseId: pastPaper.courseId,
                paperCount: count(),
            })
            .from(pastPaper)
            .where(and(eq(pastPaper.isClear, true), isNotNull(pastPaper.courseId)))
            .groupBy(pastPaper.courseId),
    ]);

    const noteCountByCourseId = new Map(
        noteCounts
            .filter((row) => row.courseId !== null)
            .map((row) => [row.courseId, row.noteCount]),
    );
    const paperCountByCourseId = new Map(
        paperCounts
            .filter((row) => row.courseId !== null)
            .map((row) => [row.courseId, row.paperCount]),
    );

    return courses.map((courseRow) => ({
        id: courseRow.id,
        code: courseRow.code,
        title: courseRow.title,
        aliases: courseRow.aliases ?? [],
        paperCount: paperCountByCourseId.get(courseRow.id) ?? 0,
        noteCount: noteCountByCourseId.get(courseRow.id) ?? 0,
    }));
});

export async function getCourseGrid(): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseGridBase();
    return courses.sort(
        (a, b) =>
            b.paperCount - a.paperCount ||
            b.noteCount - a.noteCount ||
            a.title.localeCompare(b.title),
    );
}

async function getCourseGridBase(): Promise<CourseGridItem[]> {
    const courses = await getCourseCatalogRows();

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            paperCount: c.paperCount,
            noteCount: c.noteCount,
            viewCount: 0,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0);
}

const loadCourseDetailByCode = cache(async (normalized: string) => {
    const rows = await db
        .select({
            id: course.id,
            code: course.code,
            title: course.title,
            aliases: course.aliases,
        })
        .from(course)
        .where(eq(course.code, normalized))
        .limit(1);

    const courseRow = rows[0];
    if (!courseRow) return null;

    const [paperRows, noteRows] = await Promise.all([
        db
            .select({ total: count() })
            .from(pastPaper)
            .where(and(eq(pastPaper.courseId, courseRow.id), eq(pastPaper.isClear, true))),
        db
            .select({ total: count() })
            .from(note)
            .where(and(eq(note.courseId, courseRow.id), eq(note.isClear, true))),
    ]);

    return {
        id: courseRow.id,
        code: courseRow.code,
        title: courseRow.title,
        aliases: courseRow.aliases ?? [],
        paperCount: paperRows[0]?.total ?? 0,
        noteCount: noteRows[0]?.total ?? 0,
    } satisfies CourseDetail;
});

export async function getPopularCourseGrid(limit = 6): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const [courses, viewCounts] = await Promise.all([
        getCourseCatalogRows(),
        db
            .select({
                courseId: pastPaper.courseId,
                viewCount: sql<number>`coalesce(sum(${viewHistory.count}), 0)`,
            })
            .from(viewHistory)
            .innerJoin(pastPaper, eq(viewHistory.pastPaperId, pastPaper.id))
            .where(and(eq(pastPaper.isClear, true), isNotNull(pastPaper.courseId)))
            .groupBy(pastPaper.courseId),
    ]);

    const viewCountByCourseId = new Map(
        viewCounts
            .filter((row) => row.courseId !== null)
            .map((row) => [row.courseId, Number(row.viewCount)]),
    );

    return courses
        .map((courseRow) => ({
            id: courseRow.id,
            code: courseRow.code,
            title: courseRow.title,
            paperCount: courseRow.paperCount,
            noteCount: courseRow.noteCount,
            viewCount: viewCountByCourseId.get(courseRow.id) ?? 0,
        }))
        .filter((courseRow) => courseRow.viewCount > 0)
        .sort(
            (a, b) =>
                b.viewCount - a.viewCount ||
                b.paperCount - a.paperCount ||
                b.noteCount - a.noteCount ||
                a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
        )
        .slice(0, limit);
}

export async function searchCourseGrid(query: string): Promise<CourseGridItem[]> {
    const records = (await getCourseCatalogRows())
        .filter((courseRow) => courseRow.paperCount > 0 || courseRow.noteCount > 0)
        .map((courseRow) => ({
            id: courseRow.id,
            code: courseRow.code,
            title: courseRow.title,
            paperCount: courseRow.paperCount,
            noteCount: courseRow.noteCount,
            viewCount: 0,
            aliases: courseRow.aliases,
        }));

    const grid = records.map(({ aliases: _aliases, ...courseRow }) => courseRow);
    const trimmed = query.trim();
    if (!trimmed) return grid;

    // Exact + prefix code match first.
    const upperQuery = normalizeCourseCode(trimmed);
    const exact = grid.filter((c) => c.code === upperQuery);
    if (exact.length) return exact;

    const prefix = grid.filter((c) => c.code.startsWith(upperQuery));
    if (prefix.length > 0 && prefix.length <= 50) {
        // Prefix is specific enough; return it.
        return prefix;
    }

    const lower = trimmed.toLowerCase();
    const substring = records.filter((c) => {
        if (c.code.toLowerCase().includes(lower)) return true;
        if (c.title.toLowerCase().includes(lower)) return true;
        return c.aliases.some((a) => a.toLowerCase().includes(lower));
    });

    if (substring.length > 0) {
        return substring.map(({ aliases: _aliases, ...rest }) => rest);
    }

    const fuse = new Fuse(records, {
        keys: [
            { name: "title", weight: 0.6 },
            { name: "code", weight: 0.3 },
            { name: "aliases", weight: 0.1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3,
    });

    return fuse.search(trimmed).map(({ item }) => {
        const { aliases: _aliases, ...rest } = item;
        return rest;
    });
}

export type SearchableCourseRecord = {
    id: string;
    code: string;
    title: string;
    aliases: string[];
    paperCount: number;
    noteCount: number;
    syllabusId: string | null;
};

export async function getSearchableCourses(): Promise<SearchableCourseRecord[]> {
    "use cache";
    cacheTag("courses", "past_papers", "syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const [courses, syllabusRows] = await Promise.all([
        getCourseCatalogRows(),
        db
            .select({
                id: syllabi.id,
                name: syllabi.name,
            })
            .from(syllabi)
            .orderBy(syllabi.name),
    ]);

    const syllabusIdByCode = new Map<string, string>();
    for (const syllabus of syllabusRows) {
        const code = normalizeCourseCode(syllabus.name.split("_")[0] ?? "");
        if (code && !syllabusIdByCode.has(code)) {
            syllabusIdByCode.set(code, syllabus.id);
        }
    }

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            aliases: c.aliases,
            paperCount: c.paperCount,
            noteCount: c.noteCount,
            syllabusId: syllabusIdByCode.get(c.code) ?? null,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0 || c.syllabusId)
        .sort((a, b) => b.paperCount - a.paperCount);
}

export async function getCatalogStats(): Promise<CatalogStats> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return STATIC_CATALOG_STATS;
}

export type RecentPaper = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    courseCode: string | null;
    courseTitle: string | null;
    examType: string | null;
    year: number | null;
};

export async function getRecentPapers(limit = 10): Promise<RecentPaper[]> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const papers = await db
        .select({
            id: pastPaper.id,
            title: pastPaper.title,
            thumbNailUrl: pastPaper.thumbNailUrl,
            examType: pastPaper.examType,
            year: pastPaper.year,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(pastPaper)
        .innerJoin(course, eq(pastPaper.courseId, course.id))
        .where(and(eq(pastPaper.isClear, true), isNotNull(pastPaper.courseId)))
        .orderBy(desc(pastPaper.createdAt))
        .limit(limit);

    return papers.map((p) => ({
        id: p.id,
        title: p.title,
        thumbNailUrl: p.thumbNailUrl,
        courseCode: p.courseCode ?? null,
        courseTitle: p.courseTitle ?? null,
        examType: p.examType,
        year: p.year,
    }));
}

export async function getCourseDetailByCode(code: string): Promise<CourseDetail | null> {
    "use cache";
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    return loadCourseDetailByCode(normalized);
}
