import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    count,
    desc,
    eq,
    exists,
    ilike,
    inArray,
    isNotNull,
    or,
} from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import {
    getCourseSearchRecords,
    type CourseSearchRecord,
} from "@/lib/data/course-catalog";
import {
    course,
    db,
    note,
    noteToTag,
    tag,
} from "@/db";

function buildWhere(search: string, tags: string[]) {
    const filters = [eq(note.isClear, true)];

    if (tags.length > 0) {
        filters.push(
            exists(
                db
                    .select({ id: noteToTag.a })
                    .from(noteToTag)
                    .innerJoin(tag, eq(noteToTag.b, tag.id))
                    .where(
                        and(
                            eq(noteToTag.a, note.id),
                            inArray(tag.name, tags),
                        ),
                    ),
            ),
        );
    }

    if (search) {
        const pattern = `%${search}%`;
        const searchFilter = or(
            ilike(note.title, pattern),
            exists(
                db
                    .select({ id: noteToTag.a })
                    .from(noteToTag)
                    .innerJoin(tag, eq(noteToTag.b, tag.id))
                    .where(
                        and(
                            eq(noteToTag.a, note.id),
                            ilike(tag.name, pattern),
                        ),
                    ),
            ),
        );

        if (searchFilter) {
            filters.push(searchFilter);
        }
    }

    return and(...filters);
}

export async function getNotesCount(input: { search: string; tags: string[] }) {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const where = buildWhere(input.search, input.tags);
    const rows = await db
        .select({ total: count() })
        .from(note)
        .where(where);

    return rows[0]?.total ?? 0;
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

    const items = await db
        .select({
            id: note.id,
            title: note.title,
            thumbNailUrl: note.thumbNailUrl,
        })
        .from(note)
        .where(where)
        .orderBy(desc(note.createdAt))
        .offset(skip)
        .limit(input.pageSize);

    return items.map((item) => ({
        ...item,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl),
    }));
}

export type CourseNoteListItem = {
    id: string;
    title: string;
    fileUrl: string;
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

    if (!input.courseId) return 0;

    const rows = await db
        .select({ total: count() })
        .from(note)
        .where(and(eq(note.isClear, true), eq(note.courseId, input.courseId)));

    return rows[0]?.total ?? 0;
}

export async function getCourseNotesPage(input: {
    courseId?: string | null;
    page: number;
    pageSize: number;
}): Promise<CourseNoteListItem[]> {
    "use cache";
    cacheTag("notes");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    if (!input.courseId) return [];

    const skip = Math.max(0, (input.page - 1) * input.pageSize);

    const items = await db
        .select({
            id: note.id,
            title: note.title,
            fileUrl: note.fileUrl,
            thumbNailUrl: note.thumbNailUrl,
            updatedAt: note.updatedAt,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(note)
        .leftJoin(course, eq(note.courseId, course.id))
        .where(and(eq(note.isClear, true), eq(note.courseId, input.courseId)))
        .orderBy(desc(note.updatedAt), desc(note.createdAt))
        .offset(skip)
        .limit(input.pageSize);

    return items.map((item) => ({
        id: item.id,
        title: item.title,
        fileUrl: normalizeGcsUrl(item.fileUrl) ?? item.fileUrl,
        thumbNailUrl: normalizeGcsUrl(item.thumbNailUrl) ?? item.thumbNailUrl,
        updatedAt: item.updatedAt,
        course:
            item.courseCode && item.courseTitle
                ? {
                    code: item.courseCode,
                    title: item.courseTitle,
                }
                : null,
    }));
}

async function getNoteCourseRecords(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return (await getCourseSearchRecords())
        .filter((courseRow) => courseRow.noteCount > 0)
        .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
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
    cacheTag("notes", "courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getNoteCourseRecords();

    return courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        noteCount: c.noteCount,
        paperCount: c.paperCount,
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
    cacheTag("notes", "courses");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getNoteCourseRecords();
    const noteCount = courses.reduce((sum, courseRow) => sum + courseRow.noteCount, 0);
    const courseCount = courses.length;

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
    cacheTag("notes", "courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getNoteCourseRecords();

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            aliases: c.aliases,
            noteCount: c.noteCount,
            paperCount: c.paperCount,
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

    const notes = await db
        .select({
            id: note.id,
            title: note.title,
            thumbNailUrl: note.thumbNailUrl,
            courseCode: course.code,
            courseTitle: course.title,
        })
        .from(note)
        .innerJoin(course, eq(note.courseId, course.id))
        .where(and(eq(note.isClear, true), isNotNull(note.courseId)))
        .orderBy(desc(note.createdAt))
        .limit(limit);

    return notes.map((n) => ({
        id: n.id,
        title: n.title,
        thumbNailUrl: normalizeGcsUrl(n.thumbNailUrl) ?? null,
        courseCode: n.courseCode ?? null,
        courseTitle: n.courseTitle ?? null,
    }));
}
