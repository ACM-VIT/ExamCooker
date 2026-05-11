import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    count,
    desc,
    eq,
    inArray,
    sql,
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

export type CoursePaperFilters = {
    examTypes?: ExamType[];
    slots?: string[];
    years?: number[];
    semesters?: Semester[];
    campuses?: Campus[];
    hasAnswerKey?: boolean;
};

export type CoursePaperSort = "year_desc" | "year_asc" | "recent";

export type CoursePaperListItem = {
    id: string;
    title: string;
    fileUrl: string;
    thumbNailUrl: string | null;
    examType: ExamType | null;
    slot: string | null;
    year: number | null;
    hasAnswerKey: boolean;
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

function buildWhere(courseId: string, filters: CoursePaperFilters) {
    const clauses = [eq(pastPaper.courseId, courseId), eq(pastPaper.isClear, true)];

    if (filters.examTypes?.length) {
        clauses.push(inArray(pastPaper.examType, filters.examTypes));
    }
    if (filters.slots?.length) {
        clauses.push(inArray(pastPaper.slot, filters.slots));
    }
    if (filters.years?.length) {
        clauses.push(inArray(pastPaper.year, filters.years));
    }
    if (filters.semesters?.length) {
        clauses.push(inArray(pastPaper.semester, filters.semesters));
    }
    if (filters.campuses?.length) {
        clauses.push(inArray(pastPaper.campus, filters.campuses));
    }
    if (filters.hasAnswerKey) {
        clauses.push(eq(pastPaper.hasAnswerKey, true));
    }

    return and(...clauses);
}

function sortOrder(sort: CoursePaperSort) {
    switch (sort) {
        case "year_asc":
            return [sql`${pastPaper.year} asc nulls last`, desc(pastPaper.createdAt)] as const;
        case "recent":
            return [desc(pastPaper.createdAt)] as const;
        case "year_desc":
        default:
            return [sql`${pastPaper.year} desc nulls last`, desc(pastPaper.createdAt)] as const;
    }
}

export async function getCoursePapers(input: {
    courseId: string;
    filters: CoursePaperFilters;
    sort: CoursePaperSort;
    page: number;
    pageSize: number;
}): Promise<{ papers: CoursePaperListItem[]; totalCount: number }> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const normalizedFilters = normalizeFiltersForCache(input.filters);

    return withPastPapersSurfaceRedisCache(
        {
            keyParts: [
                "course-papers",
                {
                    courseId: input.courseId,
                    filters: normalizedFilters,
                    page: input.page,
                    pageSize: input.pageSize,
                    sort: input.sort,
                },
            ],
        },
        async () => {
            const where = buildWhere(input.courseId, input.filters);
            const skip = Math.max(0, (input.page - 1) * input.pageSize);

            const [totalRows, papers] = await Promise.all([
                db
                    .select({ total: count() })
                    .from(pastPaper)
                    .where(where),
                db
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                        fileUrl: pastPaper.fileUrl,
                        thumbNailUrl: pastPaper.thumbNailUrl,
                        examType: pastPaper.examType,
                        slot: pastPaper.slot,
                        year: pastPaper.year,
                        hasAnswerKey: pastPaper.hasAnswerKey,
                    })
                    .from(pastPaper)
                    .where(where)
                    .orderBy(...sortOrder(input.sort))
                    .offset(skip)
                    .limit(input.pageSize),
            ]);

            return {
                totalCount: totalRows[0]?.total ?? 0,
                papers: papers.map((p) => ({
                    ...p,
                    fileUrl: normalizeGcsUrl(p.fileUrl) ?? p.fileUrl,
                    thumbNailUrl: normalizeGcsUrl(p.thumbNailUrl) ?? p.thumbNailUrl,
                })),
            };
        },
    );
}

export async function getCoursePaperFilterOptions(
    courseId: string,
    filters: CoursePaperFilters = {},
): Promise<CoursePaperFilterOptions> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return withPastPapersSurfaceRedisCache(
        {
            keyParts: [
                "course-paper-filter-options",
                {
                    courseId,
                    filters: normalizeFiltersForCache(filters),
                },
            ],
        },
        async () => {
            const rows = await db
                .select({
                    examType: pastPaper.examType,
                    slot: pastPaper.slot,
                    year: pastPaper.year,
                    semester: pastPaper.semester,
                    campus: pastPaper.campus,
                    hasAnswerKey: pastPaper.hasAnswerKey,
                })
                .from(pastPaper)
                .where(and(eq(pastPaper.courseId, courseId), eq(pastPaper.isClear, true)));

            const examTypeFilter = filters.examTypes?.length
                ? new Set(filters.examTypes)
                : null;
            const slotFilter = filters.slots?.length ? new Set(filters.slots) : null;
            const yearFilter = filters.years?.length ? new Set(filters.years) : null;
            const semesterFilter = filters.semesters?.length
                ? new Set(filters.semesters)
                : null;
            const campusFilter = filters.campuses?.length ? new Set(filters.campuses) : null;
            const hasAnswerKeyFilter = filters.hasAnswerKey === true;

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
                    !examTypeFilter ||
                    (row.examType !== null && examTypeFilter.has(row.examType));
                const matchesSlot =
                    !slotFilter || (row.slot !== null && slotFilter.has(row.slot));
                const matchesYear =
                    !yearFilter || (row.year !== null && yearFilter.has(row.year));
                const matchesSemester = !semesterFilter || semesterFilter.has(row.semester);
                const matchesCampus = !campusFilter || campusFilter.has(row.campus);
                const matchesHasAnswerKey = !hasAnswerKeyFilter || row.hasAnswerKey;

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
        },
    );
}
