import { cacheLife, cacheTag } from "next/cache";
import {
    and,
    count,
    desc,
    eq,
    inArray,
    sql,
} from "drizzle-orm";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type {
    ExamType,
    Semester,
    Campus,
} from "@/src/db";
import {
    campusValues,
    db,
    pastPaper,
    semesterValues,
} from "@/src/db";

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
}

export async function getCoursePaperFilterOptions(
    courseId: string,
): Promise<CoursePaperFilterOptions> {
    "use cache";
    cacheTag("past_papers");
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

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

    const examCounts: Partial<Record<ExamType, number>> = {};
    const yearCounts: Partial<Record<number, number>> = {};
    const slotCounts: Partial<Record<string, number>> = {};
    const slots = new Set<string>();
    const years = new Set<number>();
    const semesters = new Set<Semester>();
    const campuses = new Set<Campus>();
    let answerKeyCount = 0;

    for (const row of rows) {
        if (row.examType) examCounts[row.examType] = (examCounts[row.examType] ?? 0) + 1;
        if (row.slot) {
            slots.add(row.slot);
            slotCounts[row.slot] = (slotCounts[row.slot] ?? 0) + 1;
        }
        if (row.year !== null) {
            years.add(row.year);
            yearCounts[row.year] = (yearCounts[row.year] ?? 0) + 1;
        }
        semesters.add(row.semester);
        campuses.add(row.campus);
        if (row.hasAnswerKey) answerKeyCount++;
    }

    // Exam types in a stable order (by count desc).
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
        totalPapers: rows.length,
        examCounts,
        yearCounts,
        slotCounts,
    };
}
