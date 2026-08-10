import {
    campusValues,
    semesterValues,
    type Campus,
    type ExamType,
    type Semester,
} from "@/db";
import { examSlugToType } from "@/lib/exam-slug";
import type {
    CoursePaperFilters,
    CoursePaperSort,
} from "@/lib/data/course-papers";

type SearchParamValue = string | string[] | undefined;

export type PastPaperSearchParams = Record<string, SearchParamValue> & {
    exam?: SearchParamValue;
    slot?: SearchParamValue;
    year?: SearchParamValue;
    semester?: SearchParamValue;
    campus?: SearchParamValue;
    answer_key?: SearchParamValue;
    sort?: SearchParamValue;
    page?: SearchParamValue;
};

export type ParsedPastPaperSearchParams = {
    examTypes: ExamType[];
    slots: string[];
    years: number[];
    semesters: Semester[];
    campuses: Campus[];
    hasAnswerKey: boolean;
    sort: CoursePaperSort;
    page: number;
};

const SEMESTER_VALUES = new Set<Semester>(semesterValues);
const CAMPUS_VALUES = new Set<Campus>(campusValues);

function splitList(raw: SearchParamValue): string[] {
    const rawValues = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const values: string[] = [];

    for (const rawValue of rawValues) {
        for (const item of rawValue.split(",")) {
            const value = item.trim();
            if (value) values.push(value);
        }
    }

    return values;
}

function parseUppercaseEnumList<T extends string>(
    raw: SearchParamValue,
    allowed: ReadonlySet<T>,
): T[] {
    const values: T[] = [];
    for (const value of splitList(raw)) {
        const normalized = value.toUpperCase() as T;
        if (allowed.has(normalized)) values.push(normalized);
    }
    return values;
}

function parseExamTypes(raw: SearchParamValue): ExamType[] {
    const values: ExamType[] = [];
    for (const value of splitList(raw)) {
        const examType = examSlugToType(value);
        if (examType) values.push(examType);
    }
    return values;
}

function parseYears(raw: SearchParamValue): number[] {
    const values: number[] = [];
    for (const value of splitList(raw)) {
        const year = Number(value);
        if (!Number.isNaN(year)) values.push(year);
    }
    return values;
}

export function parsePastPaperSearchParams(
    raw: PastPaperSearchParams,
): ParsedPastPaperSearchParams {
    const sortParam = splitList(raw.sort)[0]?.toLowerCase();
    const sort: CoursePaperSort =
        sortParam === "seasonal" ||
        sortParam === "year_desc" ||
        sortParam === "year_asc" ||
        sortParam === "recent"
            ? sortParam
            : "seasonal";
    const pageParam = splitList(raw.page)[0] ?? "1";
    const page = Math.max(1, Number.parseInt(pageParam, 10) || 1);

    return {
        examTypes: parseExamTypes(raw.exam),
        slots: splitList(raw.slot).map((slot) => slot.toUpperCase()),
        years: parseYears(raw.year),
        semesters: parseUppercaseEnumList(raw.semester, SEMESTER_VALUES),
        campuses: parseUppercaseEnumList(raw.campus, CAMPUS_VALUES),
        hasAnswerKey: splitList(raw.answer_key).includes("1"),
        sort,
        page,
    };
}

export function getCoursePaperFilters(
    parsed: ParsedPastPaperSearchParams,
): CoursePaperFilters {
    return {
        examTypes: parsed.examTypes,
        slots: parsed.slots,
        years: parsed.years,
        semesters: parsed.semesters,
        campuses: parsed.campuses,
        hasAnswerKey: parsed.hasAnswerKey || undefined,
    };
}

export function buildPastPaperSearchString(raw: PastPaperSearchParams): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(raw)) {
        const values = splitList(value);
        if (values.length > 0) searchParams.set(key, values.join(","));
    }

    return searchParams.toString();
}
