import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type { Prisma } from "@/prisma/generated/client";

function buildWhere(search: string, tags: string[]): Prisma.NoteWhereInput {
    return {
        isClear: true,
        ...(tags.length > 0
            ? {
                tags: {
                    some: {
                        name: {
                            in: tags,
                        },
                    },
                },
            }
            : {}),
        ...(search
            ? {
                OR: [
                    { title: { contains: search, mode: "insensitive" } },
                    {
                        tags: {
                            some: {
                                name: {
                                    contains: search,
                                    mode: "insensitive",
                                },
                            },
                        },
                    },
                ],
            }
            : {}),
    };
}

export async function getNotesCount(input: { search: string; tags: string[] }) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    return prisma.note.count({ where });
}

export async function getNotesPage(input: {
    search: string;
    tags: string[];
    page: number;
    pageSize: number;
}) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const skip = (input.page - 1) * input.pageSize;

    const items = await prisma.note.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: input.pageSize,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
        },
    });

    return items.map((item) => ({
        ...item,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl),
    }));
}

function buildCourseWhere(input: {
    courseId?: string | null;
}): Prisma.NoteWhereInput {
    if (!input.courseId) return { id: "__missing-course-context__" };
    return { isClear: true, courseId: input.courseId };
}

export type CourseNoteListItem = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    updatedAt: Date;
    course: { code: string; title: string } | null;
};

export async function getCourseNotesCount(input: {
    courseId?: string | null;
}) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildCourseWhere(input);
    return prisma.note.count({ where });
}

export async function getCourseNotesPage(input: {
    courseId?: string | null;
    page: number;
    pageSize: number;
}): Promise<CourseNoteListItem[]> {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildCourseWhere(input);
    const skip = Math.max(0, (input.page - 1) * input.pageSize);

    const items = await prisma.note.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: input.pageSize,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            updatedAt: true,
            course: { select: { code: true, title: true } },
        },
    });

    return items.map((item) => ({
        ...item,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl) ?? item.thumbNailUrl,
    }));
}

/* ─── Notes course grid (mirrors courseCatalog pattern) ─── */

export type NotesCourseGridItem = {
    id: string;
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
};

export async function getNotesCourseGrid(): Promise<NotesCourseGridItem[]> {
    "use cache";
    cacheTag("notes", "courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await prisma.course.findMany({
        where: { notes: { some: { isClear: true } } },
        select: {
            id: true,
            code: true,
            title: true,
            _count: {
                select: {
                    notes: { where: { isClear: true } },
                    papers: { where: { isClear: true } },
                },
            },
        },
        orderBy: { title: "asc" },
    });

    return courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        noteCount: c._count.notes,
        paperCount: c._count.papers,
    }));
}

export async function searchNotesCourseGrid(
    query: string,
): Promise<NotesCourseGridItem[]> {
    const grid = await getNotesCourseGrid();
    const trimmed = query.trim();
    if (!trimmed) return grid;

    const upper = trimmed.toUpperCase().replace(/\s+/g, "");
    const exact = grid.filter((c) => c.code === upper);
    if (exact.length) return exact;

    const prefix = grid.filter((c) => c.code.startsWith(upper));
    if (prefix.length > 0 && prefix.length <= 50) return prefix;

    const lower = trimmed.toLowerCase();
    const substring = grid.filter((c) => {
        if (c.code.toLowerCase().includes(lower)) return true;
        if (c.title.toLowerCase().includes(lower)) return true;
        return false;
    });

    if (substring.length > 0) return substring;

    // fuzzy fallback
    const Fuse = (await import("fuse.js")).default;
    const fuse = new Fuse(grid, {
        keys: [
            { name: "title", weight: 0.6 },
            { name: "code", weight: 0.4 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3,
    });

    return fuse.search(trimmed).map(({ item }) => item);
}

export type NotesStats = {
    noteCount: number;
    courseCount: number;
};

export async function getNotesStats(): Promise<NotesStats> {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const [noteCount, courseCount] = await Promise.all([
        prisma.note.count({ where: { isClear: true } }),
        prisma.course.count({
            where: { notes: { some: { isClear: true } } },
        }),
    ]);
    return { noteCount, courseCount };
}

export type SearchableNoteCourse = {
    id: string;
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
    aliases: string[];
};

export async function getSearchableNoteCourses(): Promise<
    SearchableNoteCourse[]
> {
    "use cache";
    cacheTag("notes", "courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await prisma.course.findMany({
        where: { notes: { some: { isClear: true } } },
        select: {
            id: true,
            code: true,
            title: true,
            aliases: true,
            _count: {
                select: {
                    notes: { where: { isClear: true } },
                    papers: { where: { isClear: true } },
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
            noteCount: c._count.notes,
            paperCount: c._count.papers,
        }))
        .sort((a, b) => b.noteCount - a.noteCount);
}

export type RecentNote = {
    id: string;
    title: string;
    thumbNailUrl: string | null;
    courseCode: string | null;
    courseTitle: string | null;
};

export async function getRecentNotes(limit = 10): Promise<RecentNote[]> {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const notes = await prisma.note.findMany({
        where: { isClear: true, courseId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            title: true,
            thumbNailUrl: true,
            course: { select: { code: true, title: true } },
        },
    });
    return notes.map((n) => ({
        id: n.id,
        title: n.title,
        thumbNailUrl: normalizeGcsUrl(n.thumbNailUrl) ?? null,
        courseCode: n.course?.code ?? null,
        courseTitle: n.course?.title ?? null,
    }));
}
