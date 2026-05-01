import { cacheLife, cacheTag } from "next/cache";
import Fuse from "fuse.js";
import prisma from "@/lib/prisma";
import { normalizeCourseCode } from "@/lib/courseTags";
import { hasDatabaseUrl } from "@/lib/serverEnv";

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
    if (!hasDatabaseUrl()) {
        return [];
    }

    const courses = await prisma.course.findMany({
        select: {
            id: true,
            code: true,
            title: true,
            _count: {
                select: {
                    papers: { where: { isClear: true } },
                    notes: { where: { isClear: true } },
                },
            },
        },
    });

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            paperCount: c._count.papers,
            noteCount: c._count.notes,
            viewCount: 0,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0);
}

export async function getPopularCourseGrid(limit = 6): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    if (!hasDatabaseUrl()) {
        return [];
    }

    const rows = await prisma.$queryRaw<
        Array<{
            id: string;
            code: string;
            title: string;
            paperCount: bigint;
            noteCount: bigint;
            viewCount: bigint;
        }>
    >`
        SELECT
            c.id,
            c.code,
            c.title,
            COALESCE(papers.count, 0) AS "paperCount",
            COALESCE(notes.count, 0) AS "noteCount",
            COALESCE(views.count, 0) AS "viewCount"
        FROM "Course" c
        LEFT JOIN (
            SELECT "courseId", COUNT(*) AS count
            FROM "PastPaper"
            WHERE "isClear" = true AND "courseId" IS NOT NULL
            GROUP BY "courseId"
        ) papers ON papers."courseId" = c.id
        LEFT JOIN (
            SELECT "courseId", COUNT(*) AS count
            FROM "Note"
            WHERE "isClear" = true AND "courseId" IS NOT NULL
            GROUP BY "courseId"
        ) notes ON notes."courseId" = c.id
        LEFT JOIN (
            SELECT pp."courseId", SUM(vh.count) AS count
            FROM "ViewHistory" vh
            INNER JOIN "PastPaper" pp ON pp.id = vh."pastPaperId"
            WHERE pp."isClear" = true AND pp."courseId" IS NOT NULL
            GROUP BY pp."courseId"
        ) views ON views."courseId" = c.id
        WHERE COALESCE(papers.count, 0) > 0 OR COALESCE(notes.count, 0) > 0
        ORDER BY
            COALESCE(views.count, 0) DESC,
            COALESCE(papers.count, 0) DESC,
            COALESCE(notes.count, 0) DESC,
            c.title ASC
        LIMIT ${limit}
    `;

    return rows
        .map((row) => ({
            id: row.id,
            code: row.code,
            title: row.title,
            paperCount: Number(row.paperCount),
            noteCount: Number(row.noteCount),
            viewCount: Number(row.viewCount),
        }))
        .filter((course) => course.viewCount > 0);
}

export async function searchCourseGrid(query: string): Promise<CourseGridItem[]> {
    const grid = await getCourseGridBase();
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

    // Alias + title match via a fuzzy search. Pull aliases per course for the fuse index.
    const full = await prisma.course.findMany({
        where: { code: { in: grid.map((g) => g.code) } },
        select: { code: true, aliases: true },
    });
    const aliasByCode = new Map(full.map((c) => [c.code, c.aliases]));

    const records = grid.map((c) => ({
        ...c,
        aliases: aliasByCode.get(c.code) || [],
    }));

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

    if (!hasDatabaseUrl()) {
        return [];
    }

    const [courses, syllabi] = await Promise.all([
        prisma.course.findMany({
            select: {
                id: true,
                code: true,
                title: true,
                aliases: true,
                _count: {
                    select: {
                        papers: { where: { isClear: true } },
                        notes: { where: { isClear: true } },
                    },
                },
            },
        }),
        prisma.syllabi.findMany({
            orderBy: { name: "asc" },
            select: { id: true, name: true },
        }),
    ]);

    const syllabusIdByCode = new Map<string, string>();
    for (const syllabus of syllabi) {
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
            paperCount: c._count.papers,
            noteCount: c._count.notes,
            syllabusId: syllabusIdByCode.get(c.code) ?? null,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0 || c.syllabusId)
        .sort((a, b) => b.paperCount - a.paperCount);
}

export type CatalogStats = {
    courseCount: number;
    paperCount: number;
    noteCount: number;
};

export async function getCatalogStats(): Promise<CatalogStats> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    if (!hasDatabaseUrl()) {
        return { courseCount: 0, paperCount: 0, noteCount: 0 };
    }

    const [courseCount, paperCount, noteCount] = await Promise.all([
        prisma.course.count({
            where: {
                OR: [
                    { papers: { some: { isClear: true } } },
                    { notes: { some: { isClear: true } } },
                ],
            },
        }),
        prisma.pastPaper.count({ where: { isClear: true } }),
        prisma.note.count({ where: { isClear: true } }),
    ]);
    return { courseCount, paperCount, noteCount };
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

    if (!hasDatabaseUrl()) {
        return [];
    }

    const papers = await prisma.pastPaper.findMany({
        where: { isClear: true, courseId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            examType: true,
            year: true,
            course: { select: { code: true, title: true } },
        },
    });
    return papers.map((p) => ({
        id: p.id,
        title: p.title,
        thumbNailUrl: p.thumbNailUrl,
        courseCode: p.course?.code ?? null,
        courseTitle: p.course?.title ?? null,
        examType: p.examType,
        year: p.year,
    }));
}

export async function getCourseDetailByCode(code: string): Promise<CourseDetail | null> {
    "use cache";
    cacheTag("courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    if (!hasDatabaseUrl()) {
        return null;
    }

    const normalized = normalizeCourseCode(code);
    const course = await prisma.course.findUnique({
        where: { code: normalized },
        select: {
            id: true,
            code: true,
            title: true,
            aliases: true,
            _count: {
                select: {
                    papers: { where: { isClear: true } },
                    notes: { where: { isClear: true } },
                },
            },
        },
    });
    if (!course) return null;
    return {
        id: course.id,
        code: course.code,
        title: course.title,
        aliases: course.aliases,
        paperCount: course._count.papers,
        noteCount: course._count.notes,
    };
}
