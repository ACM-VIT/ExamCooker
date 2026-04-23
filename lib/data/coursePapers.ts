import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";
import type {
    Prisma,
    ExamType,
    Semester,
    Campus,
} from "@/prisma/generated/client";

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

function buildWhere(
    courseId: string,
    filters: CoursePaperFilters,
): Prisma.PastPaperWhereInput {
    const where: Prisma.PastPaperWhereInput = {
        courseId,
        isClear: true,
    };
    if (filters.examTypes?.length) where.examType = { in: filters.examTypes };
    if (filters.slots?.length) where.slot = { in: filters.slots };
    if (filters.years?.length) where.year = { in: filters.years };
    if (filters.semesters?.length) where.semester = { in: filters.semesters };
    if (filters.campuses?.length) where.campus = { in: filters.campuses };
    if (filters.hasAnswerKey) where.hasAnswerKey = true;
    return where;
}

function sortOrder(sort: CoursePaperSort): Prisma.PastPaperOrderByWithRelationInput[] {
    switch (sort) {
        case "year_asc":
            return [{ year: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
        case "recent":
            return [{ createdAt: "desc" }];
        case "year_desc":
        default:
            return [{ year: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }];
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

    const [totalCount, papers] = await Promise.all([
        prisma.pastPaper.count({ where }),
        prisma.pastPaper.findMany({
            where,
            orderBy: sortOrder(input.sort),
            skip,
            take: input.pageSize,
            select: {
                id: true,
                title: true,
                fileUrl: true,
                thumbNailUrl: true,
                examType: true,
                slot: true,
                year: true,
                hasAnswerKey: true,
            },
        }),
    ]);

    return {
        totalCount,
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

    const rows = await prisma.pastPaper.findMany({
        where: { courseId, isClear: true },
        select: {
            examType: true,
            slot: true,
            year: true,
            semester: true,
            campus: true,
            hasAnswerKey: true,
        },
    });

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

    return {
        examTypes,
        slots: Array.from(slots).sort(),
        years: Array.from(years).sort((a, b) => b - a),
        semesters: Array.from(semesters),
        campuses: Array.from(campuses),
        answerKeyCount,
        totalPapers: rows.length,
        examCounts,
        yearCounts,
        slotCounts,
    };
}
