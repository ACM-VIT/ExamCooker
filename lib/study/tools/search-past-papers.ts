import { tool } from "ai";
import { z } from "zod";
import {
    and,
    arrayContains,
    desc,
    eq,
    exists,
    ilike,
    or,
} from "drizzle-orm";
import {
    course,
    db,
    pastPaper,
    pastPaperToTag,
    tag,
} from "@/db";
import { normalizeCourseCode } from "@/lib/course-tags";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { getPastPaperDetailPath } from "@/lib/seo";
import { parseExamTypeInput } from "@/lib/exam-slug";
import type { ScopeContext } from "@/lib/study/scope";

const EXAM_TYPES = ["CAT-1", "CAT-2", "FAT"] as const;
const SLOTS = ["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2", "E1", "E2", "F1", "F2", "G1", "G2"] as const;

export function createSearchPastPapersTool(context: ScopeContext | null) {
    return tool({
        description:
            "Search ExamCooker's past-paper archive. Always prefer this over guessing. Supports filters for course code, exam type (CAT-1, CAT-2, FAT), slot (A1..G2), and year. Returns up to 8 of the best matches with direct links the student can open.",
        inputSchema: z.object({
            query: z
                .string()
                .optional()
                .describe("Free-text search over paper titles and tags."),
            courseCode: z
                .string()
                .optional()
                .describe(
                    "Course code like 'BCSE304L' or 'CSE1001'. If the active scope already has a course code and the user doesn't mention another, leave blank and it will be used automatically."
                ),
            examType: z
                .enum(EXAM_TYPES)
                .optional()
                .describe("Restrict to CAT-1, CAT-2, or FAT."),
            slot: z
                .enum(SLOTS)
                .optional()
                .describe("Restrict to a specific slot."),
            year: z
                .string()
                .regex(/^20\d{2}$/)
                .optional()
                .describe("Restrict to a four-digit year like 2024."),
            limit: z.number().int().min(1).max(8).default(6),
        }),
        execute: async ({ query, courseCode, examType, slot, year, limit }) => {
            const normalizedCourse = courseCode
                ? normalizeCourseCode(courseCode)
                : context?.courseCode ?? null;
            const normalizedSlot = slot?.toUpperCase();
            const trimmedQuery = query?.trim() ?? "";
            const parsedExamType = examType ? parseExamTypeInput(examType) : null;

            const runSearch = async (options: {
                includeExamFilters: boolean;
                includeQuery: boolean;
            }) => {
                const conditions = [eq(pastPaper.isClear, true)];

                const courseVariants = buildCourseCodeVariants(normalizedCourse);
                if (courseVariants.length > 0) {
                    const courseCondition = or(
                        eq(course.code, normalizeCourseCode(courseVariants[0] ?? "")),
                        arrayContains(course.aliases, [normalizeCourseCode(courseVariants[0] ?? "")]),
                        ...courseVariants.flatMap((variant) => [
                            ilike(pastPaper.title, `%${variant}%`),
                            tagNameMatches(variant, "contains"),
                        ]),
                    );
                    if (courseCondition) conditions.push(courseCondition);
                }

                if (options.includeQuery && trimmedQuery) {
                    const queryCondition = or(
                        ilike(pastPaper.title, `%${trimmedQuery}%`),
                        tagNameMatches(trimmedQuery, "contains"),
                    );
                    if (queryCondition) conditions.push(queryCondition);
                }

                if (options.includeExamFilters) {
                    if (examType && parsedExamType) {
                        const examCondition = or(
                            eq(pastPaper.examType, parsedExamType),
                            ilike(pastPaper.title, `%${examType}%`),
                            tagNameMatches(examType, "equals"),
                        );
                        if (examCondition) conditions.push(examCondition);
                    }

                    if (normalizedSlot) {
                        const slotCondition = or(
                            eq(pastPaper.slot, normalizedSlot),
                            ilike(pastPaper.title, `%${normalizedSlot}%`),
                            tagNameMatches(normalizedSlot, "equals"),
                        );
                        if (slotCondition) conditions.push(slotCondition);
                    }

                    if (year) {
                        const numericYear = Number.parseInt(year, 10);
                        const yearCondition = or(
                            eq(pastPaper.year, numericYear),
                            ilike(pastPaper.title, `%${year}%`),
                            tagNameMatches(year, "contains"),
                        );
                        if (yearCondition) conditions.push(yearCondition);
                    }
                }

                return db
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                        thumbNailUrl: pastPaper.thumbNailUrl,
                        courseCode: course.code,
                    })
                    .from(pastPaper)
                    .leftJoin(course, eq(pastPaper.courseId, course.id))
                    .where(and(...conditions))
                    .orderBy(desc(pastPaper.createdAt))
                    .limit(limit);
            };

            let items = await runSearch({
                includeExamFilters: true,
                includeQuery: true,
            });

            const usedFallback =
                items.length === 0 && Boolean(examType || normalizedSlot || year);
            if (usedFallback) {
                items = await runSearch({
                    includeExamFilters: false,
                    includeQuery: true,
                });
            }

            const usedCourseOnlyFallback =
                items.length === 0 && Boolean(normalizedCourse && trimmedQuery);
            if (usedCourseOnlyFallback) {
                items = await runSearch({
                    includeExamFilters: false,
                    includeQuery: false,
                });
            }

            return {
                query: trimmedQuery || null,
                filters: {
                    courseCode: normalizedCourse,
                    examType: examType ?? null,
                    slot: normalizedSlot ?? null,
                    year: year ?? null,
                },
                items: items.map((p) => ({
                    id: p.id,
                    title: p.title,
                    href: getPastPaperDetailPath(p.id, p.courseCode),
                    thumbnail: normalizeGcsUrl(p.thumbNailUrl) ?? p.thumbNailUrl ?? null,
                    type: "past_paper" as const,
                })),
                total: items.length,
                fallbackApplied: usedFallback || usedCourseOnlyFallback,
            };
        },
    });
}

function tagNameMatches(value: string, mode: "contains" | "equals") {
    const pattern = mode === "equals" ? value : `%${value}%`;
    return exists(
        db
            .select({ id: pastPaperToTag.a })
            .from(pastPaperToTag)
            .innerJoin(tag, eq(pastPaperToTag.b, tag.id))
            .where(
                and(
                    eq(pastPaperToTag.a, pastPaper.id),
                    mode === "equals" ? ilike(tag.name, value) : ilike(tag.name, pattern),
                ),
            ),
    );
}

function buildCourseCodeVariants(code: string | null): string[] {
    if (!code) return [];
    const compact = normalizeCourseCode(code);
    const match = compact.match(/^([A-Z]+)(\d+)([A-Z]*)$/);
    if (!match) return [compact];
    const [, prefix, digits, suffix] = match;
    const spaced = `${prefix} ${digits}${suffix}`;
    return [compact, spaced];
}
