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

    // Search the full course catalog, not just courses that already have notes.
    // Gating this list to `noteCount > 0` made real but empty courses (e.g.
    // BACHY105 "Applied Chemistry", which has papers but no notes yet) invisible
    // from the notes search, so searching for them dead-ended on "No courses
    // found" — the same mistake `getSearchableCourses` fixed for the homepage.
    // The default browse grid and hero stats re-apply the notes gate below;
    // search paths use the full set and the course page handles the empty state.
    return (await getCourseSearchRecords())
        .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
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

export async function getNotesCourseGrid(): Promise<NotesCourseGridItem[]> {
    "use cache";
    cacheTag("notes", "courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    // The default browse grid only lists courses that actually have notes.
    const courses = await getNoteCourseRecords();

    return courses
        .filter((c) => c.noteCount > 0)
        .map(toNotesGridItem);
}

export async function searchNotesCourseGrid(
    query: string,
): Promise<NotesCourseGridItem[]> {
    const trimmed = query.trim();
    // No query → fall back to the gated browse grid (courses with notes only).
    if (!trimmed) return getNotesCourseGrid();

    // Search across the full catalog so real-but-empty courses (e.g. BACHY105
    // "Applied Chemistry") are findable instead of dead-ending on "No courses
    // found". The course page handles the empty state gracefully.
    const grid = (await getNoteCourseRecords()).map(toNotesGridItem);

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

    // Fuzzy fallback shared with the homepage / notes dropdown so typos and
    // word-order variations resolve identically everywhere.
    const fuse = createCourseFuse(grid);

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

    // Hero stats count only courses that actually have notes.
    const courses = (await getNoteCourseRecords()).filter(
        (courseRow) => courseRow.noteCount > 0,
    );
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
