import { cacheLife, cacheTag } from "next/cache";
import Fuse from "fuse.js";
import prisma from "@/lib/prisma";
import { normalizeCourseCode } from "@/lib/courseTags";

export type CourseGridItem = {
    id: string;
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
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
        orderBy: { title: "asc" },
    });

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            paperCount: c._count.papers,
            noteCount: c._count.notes,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0);
}

export async function searchCourseGrid(query: string): Promise<CourseGridItem[]> {
    const grid = await getCourseGrid();
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
};

export async function getSearchableCourses(): Promise<SearchableCourseRecord[]> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await prisma.course.findMany({
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
    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            aliases: c.aliases,
            paperCount: c._count.papers,
            noteCount: c._count.notes,
        }))
        .filter((c) => c.paperCount > 0 || c.noteCount > 0)
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
