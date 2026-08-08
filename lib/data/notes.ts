import { withRuntimeIo } from "@/lib/data/runtime-io";
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
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { createCourseFuse } from "@/lib/course-search-fuse";
import { normalizeCourseCode } from "@/lib/course-tags";
import {
    getCoursePickerRecords,
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

async function getNotesCountCached(input: { search: string; tags: string[] }) {
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

async function getNotesPageCached(input: {
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

async function getCourseNotesCountCached(input: {
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

async function getCourseNotesPageCached(input: {
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

// Notes search intentionally sees the full catalog. Empty courses lead to a
// real upload-prompt page, while the default browse grid remains content-only.
async function getNoteSearchRecords(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return [...(await getCoursePickerRecords())].sort(
        (a, b) =>
            b.noteCount - a.noteCount ||
            a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
    );
}

function toNotesGridItem(courseRow: CourseSearchRecord): NotesCourseGridItem {
    return {
        id: courseRow.id,
        code: courseRow.code,
        title: courseRow.title,
        noteCount: courseRow.noteCount,
        paperCount: courseRow.paperCount,
    };
}

/* ─── Notes course grid (mirrors courseCatalog pattern) ─── */

export type NotesCourseGridItem = {
    id: string;
    code: string;
    title: string;
    noteCount: number;
    paperCount: number;
};

async function getNotesCourseGridCached(): Promise<NotesCourseGridItem[]> {
    "use cache";
    cacheTag("notes", "courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getNoteCourseRecords();

    return courses.map(toNotesGridItem);
}

export async function searchNotesCourseGrid(
    query: string,
): Promise<NotesCourseGridItem[]> {
    const trimmed = query.trim();
    if (!trimmed) return getNotesCourseGrid();

    const records = await getNoteSearchRecords();

    const upper = normalizeCourseCode(trimmed);
    const aliasCodes = new Set(getAliasCourseCodes(trimmed));
    const exact = records.filter(
        (courseRow) =>
            courseRow.code === upper || aliasCodes.has(courseRow.code),
    );
    if (exact.length) return exact.map(toNotesGridItem);

    const prefix =
        upper.length >= 2
            ? records.filter((courseRow) => courseRow.code.startsWith(upper))
            : [];
    if (prefix.length > 0 && prefix.length <= 50) {
        return prefix.map(toNotesGridItem);
    }

    const lower = trimmed.toLowerCase();
    const substring = records.filter(
        (courseRow) =>
            courseRow.code.toLowerCase().includes(lower) ||
            courseRow.title.toLowerCase().includes(lower) ||
            courseRow.aliases.some((alias) =>
                alias.toLowerCase().includes(lower),
            ),
    );

    if (substring.length > 0) return substring.map(toNotesGridItem);

    // Fuzzy fallback shared with the homepage / notes dropdown so typos and
    // word-order variations resolve identically everywhere.
    const fuse = createCourseFuse(records);

    return fuse.search(trimmed).map(({ item }) => toNotesGridItem(item));
}

export type NotesStats = {
    noteCount: number;
    courseCount: number;
};

async function getNotesStatsCached(): Promise<NotesStats> {
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

async function getSearchableNoteCoursesCached(): Promise<
    SearchableNoteCourse[]
> {
    "use cache";
    cacheTag("notes", "courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getNoteSearchRecords();

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

async function getRecentNotesCached(limit = 10): Promise<RecentNote[]> {
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

export const getNotesCount = withRuntimeIo(getNotesCountCached);
export const getNotesPage = withRuntimeIo(getNotesPageCached);
export const getCourseNotesCount = withRuntimeIo(getCourseNotesCountCached);
export const getCourseNotesPage = withRuntimeIo(getCourseNotesPageCached);
export const getNotesCourseGrid = withRuntimeIo(getNotesCourseGridCached);
export const getNotesStats = withRuntimeIo(getNotesStatsCached);
export const getSearchableNoteCourses = withRuntimeIo(getSearchableNoteCoursesCached);
export const getRecentNotes = withRuntimeIo(getRecentNotesCached);
