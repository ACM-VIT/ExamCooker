import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    eq,
} from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { withPastPapersSurfaceRedisCache } from "@/lib/cache/past-papers-surface-cache";
import type {
    ExamType,
    Semester,
    Campus,
} from "@/db";
import {
    campusValues,
    db,
    pastPaper,
    semesterValues,
} from "@/db";
import type { PdfPageEdits } from "@/lib/pdf/page-edits";

export type CoursePaperFilters = {
    examTypes?: ExamType[];
    slots?: string[];
    years?: number[];
    semesters?: Semester[];
    campuses?: Campus[];
    hasAnswerKey?: boolean;
};

export type CoursePaperSort = "seasonal" | "year_desc" | "year_asc" | "recent";

export type CoursePaperListItem = {
    id: string;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    hasAnswerKey: boolean;
    pageEdits: PdfPageEdits | null;
};

export type CoursePaperFilterOptions = {
    examTypes: ExamType[];
    slots: string[];
    years: number[];
    semesters: Semester[];
    campuses: Campus[];
    answerKeyCount: number;
    totalPapers: number;
    examCounts: Partial<Record<ExamType, number>>;
    yearCounts: Partial<Record<number, number>>;
    slotCounts: Partial<Record<string, number>>;
};

type CoursePaperFilterOptionRow = {
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    semester: Semester;
    campus: Campus;
    hasAnswerKey: boolean;
};

type CoursePaperRow = CoursePaperListItem &
    CoursePaperFilterOptionRow & {
        createdAtTime: number;
    };

function normalizeFiltersForCache(filters: CoursePaperFilters) {
    return {
        examTypes: [...(filters.examTypes ?? [])].sort(),
        slots: [...(filters.slots ?? [])].sort(),
        years: [...(filters.years ?? [])].sort((a, b) => a - b),
        semesters: [...(filters.semesters ?? [])].sort(),
        campuses: [...(filters.campuses ?? [])].sort(),
        hasAnswerKey: filters.hasAnswerKey === true,
    };
}

async function getCoursePaperRows(courseId: string): Promise<CoursePaperRow[]> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return withPastPapersSurfaceRedisCache(
        {
            keyParts: ["course-paper-rows-v2", { courseId }],
        },
        async () => {
            const rows = await db
                .select({
                    id: pastPaper.id,
                    title: pastPaper.title,
                    fileUrl: pastPaper.fileUrl,
                    thumbNailUrl: pastPaper.thumbNailUrl,
                    examType: pastPaper.examType,
                    slot: pastPaper.slot,
                    year: pastPaper.year,
                    semester: pastPaper.semester,
                    campus: pastPaper.campus,
                    hasAnswerKey: pastPaper.hasAnswerKey,
                    pageEdits: pastPaper.pageEdits,
                    createdAt: pastPaper.createdAt,
                })
                .from(pastPaper)
                .where(and(eq(pastPaper.courseId, courseId), eq(pastPaper.isClear, true)));

            return rows.map((paper) => ({
                id: paper.id,
                title: paper.title,
                fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
                thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
                examType: paper.examType,
                slot: paper.slot,
                year: paper.year,
                semester: paper.semester,
                campus: paper.campus,
                hasAnswerKey: paper.hasAnswerKey,
                pageEdits: paper.pageEdits ?? null,
                createdAtTime: paper.createdAt.getTime(),
            }));
        },
    );
}

function buildFilterSets(filters: CoursePaperFilters) {
    const normalizedFilters = normalizeFiltersForCache(filters);

    return {
        examTypes: normalizedFilters.examTypes.length ? new Set(normalizedFilters.examTypes) : null,
        slots: normalizedFilters.slots.length ? new Set(normalizedFilters.slots) : null,
        years: normalizedFilters.years.length ? new Set(normalizedFilters.years) : null,
        semesters: normalizedFilters.semesters.length ? new Set(normalizedFilters.semesters) : null,
        campuses: normalizedFilters.campuses.length ? new Set(normalizedFilters.campuses) : null,
        hasAnswerKey: normalizedFilters.hasAnswerKey,
    };
}

function rowMatchesFilters(
    row: CoursePaperFilterOptionRow,
    filters: ReturnType<typeof buildFilterSets>,
) {
    if (filters.examTypes && (row.examType === null || !filters.examTypes.has(row.examType))) {
        return false;
    }
    if (filters.slots && (row.slot === null || !filters.slots.has(row.slot))) {
        return false;
    }
    if (filters.years && (row.year === null || !filters.years.has(row.year))) {
        return false;
    }
    if (filters.semesters && !filters.semesters.has(row.semester)) {
        return false;
    }
    if (filters.campuses && !filters.campuses.has(row.campus)) {
        return false;
    }
    if (filters.hasAnswerKey && !row.hasAnswerKey) {
        return false;
    }

    return true;
}

function comparePaperRows(sort: CoursePaperSort, examFocus: ExamType) {
    return (a: CoursePaperRow, b: CoursePaperRow) => {
        if (sort === "recent") {
            return b.createdAtTime - a.createdAtTime;
        }

        if (sort === "seasonal") {
            const aIsExamFocus = a.examType === examFocus;
            const bIsExamFocus = b.examType === examFocus;
            if (aIsExamFocus !== bIsExamFocus) return aIsExamFocus ? -1 : 1;
        }

        if (a.year === null && b.year === null) {
            return b.createdAtTime - a.createdAtTime;
        }
        if (a.year === null) return 1;
        if (b.year === null) return -1;

        const yearDelta = sort === "year_asc" ? a.year - b.year : b.year - a.year;
        return yearDelta || b.createdAtTime - a.createdAtTime;
    };
}

function toCoursePaperListItem(row: CoursePaperRow): CoursePaperListItem {
    return {
        id: row.id,
        title: row.title,
        fileUrl: row.fileUrl,
        thumbNailUrl: row.thumbNailUrl,
        examType: row.examType,
        slot: row.slot,
        year: row.year,
        hasAnswerKey: row.hasAnswerKey,
        pageEdits: row.pageEdits ?? null,
    };
}

export async function getCoursePapers(input: {
    courseId: string;
    filters: CoursePaperFilters;
    sort: CoursePaperSort;
    examFocus: ExamType;
    page: number;
    pageSize: number;
}): Promise<{ papers: CoursePaperListItem[]; totalCount: number }> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await getCoursePaperRows(input.courseId);
    const filterSets = buildFilterSets(input.filters);
    const filteredRows: CoursePaperRow[] = [];

    for (const row of rows) {
        if (rowMatchesFilters(row, filterSets)) filteredRows.push(row);
    }

    filteredRows.sort(comparePaperRows(input.sort, input.examFocus));

    const skip = Math.max(0, (input.page - 1) * input.pageSize);
    const visibleRows = filteredRows.slice(skip, skip + input.pageSize);

    return {
        totalCount: filteredRows.length,
        papers: visibleRows.map(toCoursePaperListItem),
    };
}

export async function getCoursePaperFilterOptions(
    courseId: string,
    filters: CoursePaperFilters = {},
): Promise<CoursePaperFilterOptions> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const rows = await getCoursePaperRows(courseId);
    const filterSets = buildFilterSets(filters);

    const examCounts: Partial<Record<ExamType, number>> = {};
    const yearCounts: Partial<Record<number, number>> = {};
    const slotCounts: Partial<Record<string, number>> = {};
    const slots = new Set<string>();
    const years = new Set<number>();
    const semesters = new Set<Semester>();
    const campuses = new Set<Campus>();
    let answerKeyCount = 0;
    let totalPapers = 0;

    for (const row of rows) {
        const matchesExamType =
            !filterSets.examTypes ||
            (row.examType !== null && filterSets.examTypes.has(row.examType));
        const matchesSlot =
            !filterSets.slots || (row.slot !== null && filterSets.slots.has(row.slot));
        const matchesYear =
            !filterSets.years || (row.year !== null && filterSets.years.has(row.year));
        const matchesSemester =
            !filterSets.semesters || filterSets.semesters.has(row.semester);
        const matchesCampus =
            !filterSets.campuses || filterSets.campuses.has(row.campus);
        const matchesHasAnswerKey = !filterSets.hasAnswerKey || row.hasAnswerKey;

        if (
            matchesSlot &&
            matchesYear &&
            matchesSemester &&
            matchesCampus &&
            matchesHasAnswerKey
        ) {
            totalPapers++;
            if (row.examType) {
                examCounts[row.examType] = (examCounts[row.examType] ?? 0) + 1;
            }
        }

        if (
            matchesExamType &&
            matchesSlot &&
            matchesSemester &&
            matchesCampus &&
            matchesHasAnswerKey &&
            row.year !== null
        ) {
            years.add(row.year);
            yearCounts[row.year] = (yearCounts[row.year] ?? 0) + 1;
        }

        if (
            matchesExamType &&
            matchesYear &&
            matchesSemester &&
            matchesCampus &&
            matchesHasAnswerKey &&
            row.slot
        ) {
            slots.add(row.slot);
            slotCounts[row.slot] = (slotCounts[row.slot] ?? 0) + 1;
        }

        if (
            matchesExamType &&
            matchesSlot &&
            matchesYear &&
            matchesCampus &&
            matchesHasAnswerKey
        ) {
            semesters.add(row.semester);
        }

        if (
            matchesExamType &&
            matchesSlot &&
            matchesYear &&
            matchesSemester &&
            matchesHasAnswerKey
        ) {
            campuses.add(row.campus);
        }

        if (
            matchesExamType &&
            matchesSlot &&
            matchesYear &&
            matchesSemester &&
            matchesCampus &&
            row.hasAnswerKey
        ) {
            answerKeyCount++;
        }
    }

    const examTypes = (Object.keys(examCounts) as ExamType[]).sort(
        (a, b) => (examCounts[b] ?? 0) - (examCounts[a] ?? 0),
    );
    const semesterOrder = new Map(semesterValues.map((value, index) => [value, index]));
    const campusOrder = new Map(campusValues.map((value, index) => [value, index]));

    return {
        examTypes,
        slots: Array.from(slots).sort(),
        years: Array.from(years).sort((a, b) => b - a),
        semesters: Array.from(semesters).sort(
            (a, b) => (semesterOrder.get(a) ?? 0) - (semesterOrder.get(b) ?? 0),
        ),
        campuses: Array.from(campuses).sort(
            (a, b) => (campusOrder.get(a) ?? 0) - (campusOrder.get(b) ?? 0),
        ),
        answerKeyCount,
        totalPapers,
        examCounts,
        yearCounts,
        slotCounts,
    };
}
