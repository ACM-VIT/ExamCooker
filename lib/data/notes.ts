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

// Courses that already have notes — used for the default browse grid and the
// hero stats, where surfacing empty courses would only add noise.
async function getNoteCourseRecords(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return (await getCourseSearchRecords())
        .filter((courseRow) => courseRow.noteCount > 0)
        .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
}

// The full course catalog, used for notes *search* (the dropdown and the
// `/notes?search=` grid). Gating search on `noteCount > 0` made real but empty
// courses (e.g. BHUM104L "Macro Economics") invisible, so searching for them
// dead-ended on "No courses found". Content-rich courses still rank first
// (below); the course notes page renders a "no notes yet" upload prompt for the
// empty ones instead of 404-ing.
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

function toNotesCourseGridItem(record: CourseSearchRecord): NotesCourseGridItem {
    return {
        id: record.id,
        code: record.code,
        title: record.title,
        noteCount: record.noteCount,
        paperCount: record.paperCount,
    };
}

export async function searchNotesCourseGrid(
    query: string,
): Promise<NotesCourseGridItem[]> {
    const records = await getNoteSearchRecords();
    const trimmed = query.trim();
    if (!trimmed) return records.map(toNotesCourseGridItem);

    const upper = normalizeCourseCode(trimmed);
    const exact = records.filter((c) => c.code === upper);
    if (exact.length) return exact.map(toNotesCourseGridItem);

    const prefix = records.filter((c) => c.code.startsWith(upper));
    if (prefix.length > 0 && prefix.length <= 50) {
        return prefix.map(toNotesCourseGridItem);
    }

    const lower = trimmed.toLowerCase();
    const substring = records.filter(
        (c) =>
            c.code.toLowerCase().includes(lower) ||
            c.title.toLowerCase().includes(lower) ||
            c.aliases.some((a) => a.toLowerCase().includes(lower)),
    );
    if (substring.length > 0) return substring.map(toNotesCourseGridItem);

    // Fuzzy fallback shares the homepage weights + threshold via createCourseFuse.
    const fuse = createCourseFuse(records);
    return fuse.search(trimmed).map(({ item }) => toNotesCourseGridItem(item));
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

    const courses = await getNoteSearchRecords();

    return courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        aliases: c.aliases,
        noteCount: c.noteCount,
        paperCount: c.paperCount,
    }));
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
