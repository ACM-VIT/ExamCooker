import { withRuntimeIo } from "@/lib/data/runtime-io";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { getAliasCourseCodes } from "@/lib/course-aliases";
import { createCourseFuse } from "@/lib/course-search-fuse";
import {
    and,
    count,
    desc,
    eq,
    isNotNull,
    sql,
} from "drizzle-orm";
import { withPastPapersSurfaceRedisCache } from "@/lib/cache/past-papers-surface-cache";
import { normalizeCourseCode } from "@/lib/course-tags";
import { course, db, note, pastPaper, syllabi, viewHistory } from "@/db";

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

const UPCOMING_EXAMS_COURSE_CODES = [
    "BMAT201L",
    "BCSE304L",
    "BMAT101L",
    "BGER101L",
    "BCSE355L",
    "BCSE202L",
    "BCSE303L",
    "BCSE102L",
    "BPHY101L",
    "BCSE204L",
    "BMEE209L",
    "BMAT102L",
];

export type CourseSearchRecord = {
    id: string;
    code: string;
    title: string;
    paperCount: number;
    noteCount: number;
    aliases: string[];
};

async function getSyllabusIdByCourseCode() {
    "use cache";
    cacheTag("syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const syllabusRows = await db
        .select({
            id: syllabi.id,
            name: syllabi.name,
        })
        .from(syllabi)
        .orderBy(syllabi.name);

    const syllabusIdByCode: Record<string, string> = {};
    for (const syllabus of syllabusRows) {
        const code = normalizeCourseCode(syllabus.name.split("_")[0] ?? "");
        if (code && !syllabusIdByCode[code]) {
            syllabusIdByCode[code] = syllabus.id;
        }
    }

    return syllabusIdByCode;
}

// Words that never contribute a meaningful initial to a derived acronym.
const ACRONYM_STOPWORDS = new Set([
    "and",
    "of",
    "the",
    "for",
    "to",
    "in",
    "on",
    "a",
    "an",
    "with",
    "using",
    "its",
    "or",
    "de",
    "&",
]);
const ROMAN_NUMERAL = /^[ivx]+$/i;

// Derive a search acronym from a course title's significant-word initials so
// codes like "NLP" (Natural Language Processing) resolve without anyone
// remembering to add a hand-maintained COURSE_ACRONYMS entry. Returns null when
// the title is too short (or too long) to make a useful acronym. Merged into
// each course's aliases below so both the server-side search
// (`searchCourseGrid`) and the client dropdown's Fuse index match on it.
function deriveCourseAcronym(title: string): string | null {
    const words = title
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
        .filter((word) => {
            const lower = word.toLowerCase();
            if (ACRONYM_STOPWORDS.has(lower)) return false;
            if (word.length <= 3 && ROMAN_NUMERAL.test(word)) return false;
            if (/^\d+$/.test(word)) return false;
            return true;
        });

    if (words.length < 3 || words.length > 6) return null;

    const acronym = words.map((word) => word[0]).join("").toUpperCase();
    if (acronym.length < 3 || acronym.length > 6) return null;
    return acronym;
}

async function getCourseCatalogRows(): Promise<CourseCatalogRow[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return withPastPapersSurfaceRedisCache(
        {
            keyParts: ["course-catalog-rows"],
        },
        async () => {
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

            return courses.map((courseRow) => {
                const baseAliases = courseRow.aliases ?? [];
                const acronym = deriveCourseAcronym(courseRow.title);
                const aliases =
                    acronym &&
                    !baseAliases.some((a) => a.toUpperCase() === acronym)
                        ? [...baseAliases, acronym]
                        : baseAliases;

                return {
                    id: courseRow.id,
                    code: courseRow.code,
                    title: courseRow.title,
                    aliases,
                    paperCount: paperCountByCourseId.get(courseRow.id) ?? 0,
                    noteCount: noteCountByCourseId.get(courseRow.id) ?? 0,
                };
            });
        },
    );
}

async function getCourseSearchRecordsCached(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseCatalogRows();

    return courses
        .filter((courseRow) => courseRow.paperCount > 0 || courseRow.noteCount > 0)
        .map((courseRow) => ({
            id: courseRow.id,
            code: courseRow.code,
            title: courseRow.title,
            paperCount: courseRow.paperCount,
            noteCount: courseRow.noteCount,
            aliases: courseRow.aliases,
        }));
}

// Ungated course list for past-papers *search* (the dropdown + free-text
// results grid). Mirrors the homepage's `getSearchableCourses`: browsing grids
// stay gated to courses that already have content, but search must reach every
// real course so acronyms and partial codes for content-less courses ("BCE",
// "NLP") resolve to the course page instead of dead-ending on an empty results
// page. Ranked content-first so richer courses lead the matches.
async function getSearchableCourseRecordsCached(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseCatalogRows();

    return courses
        .map((courseRow) => ({
            id: courseRow.id,
            code: courseRow.code,
            title: courseRow.title,
            paperCount: courseRow.paperCount,
            noteCount: courseRow.noteCount,
            aliases: courseRow.aliases,
        }))
        .sort(
            (a, b) =>
                b.paperCount - a.paperCount ||
                b.noteCount - a.noteCount ||
                a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
        );
}

async function getCoursePickerRecordsCached(): Promise<CourseSearchRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseCatalogRows();

    return courses
        .map((courseRow) => ({
            id: courseRow.id,
            code: courseRow.code,
            title: courseRow.title,
            paperCount: courseRow.paperCount,
            noteCount: courseRow.noteCount,
            aliases: courseRow.aliases,
        }))
        .sort((a, b) => a.code.localeCompare(b.code));
}

const getCourseSearchIndex = cache(async () => {
    // Ungated so the fuzzy fallback can still reach content-less courses that the
    // exact / prefix / substring passes missed.
    const records = await getSearchableCourseRecords();

    return createCourseFuse(records);
});

async function getCourseGridCached(): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
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
    const courses = await getCourseSearchRecords();

    return courses.map(({ aliases: _aliases, ...courseRow }) => ({
        ...courseRow,
        viewCount: 0,
    }));
}

async function loadCourseDetailByCode(normalized: string) {
    return withPastPapersSurfaceRedisCache(
        {
            keyParts: ["course-detail-by-code", normalized],
        },
        async () => {
            const courseRows = await db
                .select({
                    id: course.id,
                    code: course.code,
                    title: course.title,
                    aliases: course.aliases,
                })
                .from(course)
                .where(eq(course.code, normalized))
                .limit(1);

            const courseRow = courseRows[0];
            if (!courseRow) return null;

            const [paperRows, noteRows] = await Promise.all([
                db
                    .select({ total: count() })
                    .from(pastPaper)
                    .where(
                        and(
                            eq(pastPaper.courseId, courseRow.id),
                            eq(pastPaper.isClear, true),
                        ),
                    ),
                db
                    .select({ total: count() })
                    .from(note)
                    .where(
                        and(
                            eq(note.courseId, courseRow.id),
                            eq(note.isClear, true),
                        ),
                    ),
            ]);

            return {
                id: courseRow.id,
                code: courseRow.code,
                title: courseRow.title,
                aliases: courseRow.aliases ?? [],
                paperCount: paperRows[0]?.total ?? 0,
                noteCount: noteRows[0]?.total ?? 0,
            } satisfies CourseDetail;
        },
    );
}

async function getPopularCourseGridCached(limit = 6): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
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
    // Search the full catalog, not just courses that already have content, so a
    // real but empty course still surfaces (its page handles the empty state).
    const records = await getSearchableCourseRecords();
    const grid = records.map(({ aliases: _aliases, ...courseRow }) => ({
        ...courseRow,
        viewCount: 0,
    }));
    const trimmed = query.trim();
    if (!trimmed) return grid;

    // Exact code and shared acronym/alias matches first so free-text submissions
    // return the same courses that the client-side dropdown previews.
    const upperQuery = normalizeCourseCode(trimmed);
    const aliasCodes = new Set(getAliasCourseCodes(trimmed));
    const exact = records.filter(
        (courseRow) =>
            courseRow.code === upperQuery ||
            aliasCodes.has(courseRow.code) ||
            courseRow.aliases.some(
                (alias) => normalizeCourseCode(alias) === upperQuery,
            ),
    );
    if (exact.length) {
        return exact.map(({ aliases: _aliases, ...courseRow }) => ({
            ...courseRow,
            viewCount: 0,
        }));
    }

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
        return substring.map(({ aliases: _aliases, ...rest }) => ({
            ...rest,
            viewCount: 0,
        }));
    }

    const fuse = await getCourseSearchIndex();
    return fuse.search(trimmed).map(({ item }) => {
        const { aliases: _aliases, ...rest } = item;
        return {
            ...rest,
            viewCount: 0,
        };
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

async function getSearchableCoursesCached(): Promise<SearchableCourseRecord[]> {
    "use cache";
    cacheTag("courses", "notes", "past_papers", "syllabus");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    // Search the full course catalog, not just courses that already have
    // content. Gating this list to courses with papers/notes/syllabus made real
    // but empty courses invisible from the homepage, so searching for them
    // dead-ended on "No courses found". Content-rich courses still rank first
    // (below), and their destination pages handle the empty state gracefully.
    const [courses, syllabusIdByCode] = await Promise.all([
        getCourseCatalogRows(),
        getSyllabusIdByCourseCode(),
    ]);

    return courses
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            aliases: c.aliases,
            paperCount: c.paperCount,
            noteCount: c.noteCount,
            syllabusId: syllabusIdByCode[c.code] ?? null,
        }))
        .sort(
            (a, b) =>
                b.paperCount - a.paperCount ||
                b.noteCount - a.noteCount ||
                a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
        );
}

async function getCatalogStatsCached(): Promise<CatalogStats> {
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
    slot: string | null;
    year: number | null;
};

async function getRecentPapersCached(limit = 10): Promise<RecentPaper[]> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return withPastPapersSurfaceRedisCache(
        {
            keyParts: ["recent-papers", { limit }],
        },
        async () => {
            const papers = await db
                .select({
                    id: pastPaper.id,
                    title: pastPaper.title,
                    thumbNailUrl: pastPaper.thumbNailUrl,
                    examType: pastPaper.examType,
                    slot: pastPaper.slot,
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
                slot: p.slot,
                year: p.year,
            }));
        },
    );
}

async function getCourseDetailByCodeCached(code: string): Promise<CourseDetail | null> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalized = normalizeCourseCode(code);
    if (!normalized) return null;
    return loadCourseDetailByCode(normalized);
}

//todo: we need build a way to get upcoming exams reliably and with least maintenance overhead
async function getUpcomingExamsCourseGridCached(): Promise<CourseGridItem[]> {
    "use cache";
    cacheTag("courses", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseCatalogRows();
    const gridItems = courses
        .filter((courseRow) => UPCOMING_EXAMS_COURSE_CODES.includes(courseRow.code))
        .map(c => ({
            id: c.id,
            code: c.code,
            title: c.title,
            paperCount: c.paperCount,
            noteCount: c.noteCount,
            viewCount: 0,
        }));

    return gridItems.sort(
        (a, b) =>
            UPCOMING_EXAMS_COURSE_CODES.indexOf(a.code) -
            UPCOMING_EXAMS_COURSE_CODES.indexOf(b.code),
    );
}

async function getUpcomingExamsCourseGridCountCached(): Promise<number> {
    "use cache";
    cacheTag("courses", "notes", "past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const courses = await getCourseCatalogRows();
    return courses.filter((courseRow) =>
        UPCOMING_EXAMS_COURSE_CODES.includes(courseRow.code),
    ).length;
}

export const getCourseSearchRecords = withRuntimeIo(getCourseSearchRecordsCached);
export const getSearchableCourseRecords = withRuntimeIo(getSearchableCourseRecordsCached);
export const getCoursePickerRecords = withRuntimeIo(getCoursePickerRecordsCached);
export const getCourseGrid = withRuntimeIo(getCourseGridCached);
export const getPopularCourseGrid = withRuntimeIo(getPopularCourseGridCached);
export const getSearchableCourses = withRuntimeIo(getSearchableCoursesCached);
export const getCatalogStats = withRuntimeIo(getCatalogStatsCached);
export const getRecentPapers = withRuntimeIo(getRecentPapersCached);
export const getCourseDetailByCode = withRuntimeIo(getCourseDetailByCodeCached);
export const getUpcomingExamsCourseGrid = withRuntimeIo(getUpcomingExamsCourseGridCached);
export const getUpcomingExamsCourseGridCount = withRuntimeIo(getUpcomingExamsCourseGridCountCached);
