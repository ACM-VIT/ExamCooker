"use server";

import { and, desc, eq, ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth";
import { course, db, pastPaper } from "@/db";
import type { PaperLinkOption } from "@/app/components/mod/paperLinkTypes";

const schema = z.object({
    query: z.string().trim().min(1).max(300),
    excludePaperId: z.string().min(1),
    courseId: z.string().min(1).nullable().optional(),
    limit: z.number().int().min(1).max(20).optional(),
});

function escapeLike(value: string) {
    return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function extractPaperId(query: string) {
    const trimmed = query.trim();
    const urlMatch = trimmed.match(/\/paper\/([^/?#]+)/i);
    if (urlMatch?.[1]) return urlMatch[1];
    return trimmed;
}

function scoreResult(result: PaperLinkOption & { courseId: string | null }, input: {
    query: string;
    extractedPaperId: string;
    courseId: string | null;
}) {
    const normalizedQuery = input.query.toLowerCase();
    const normalizedTitle = result.title.toLowerCase();
    const normalizedCourseCode = result.courseCode?.toLowerCase() ?? "";
    const normalizedCourseTitle = result.courseTitle?.toLowerCase() ?? "";

    let score = 0;
    if (result.id === input.extractedPaperId) score += 1000;
    if (normalizedTitle === normalizedQuery) score += 250;
    if (normalizedTitle.startsWith(normalizedQuery)) score += 150;
    if (normalizedTitle.includes(normalizedQuery)) score += 100;
    if (normalizedCourseCode === normalizedQuery) score += 120;
    if (normalizedCourseCode.startsWith(normalizedQuery)) score += 80;
    if (normalizedCourseTitle.includes(normalizedQuery)) score += 60;
    if (input.courseId && result.courseId === input.courseId) score += 40;
    if (!result.hasAnswerKey) score += 10;

    return score;
}

export async function searchPastPaperLinkTargets(input: z.input<typeof schema>) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const parsed = schema.parse(input);
    const limit = parsed.limit ?? 8;
    const extractedPaperId = extractPaperId(parsed.query);
    const pattern = `%${escapeLike(parsed.query)}%`;

    const rows = await db
        .select({
            id: pastPaper.id,
            title: pastPaper.title,
            courseId: pastPaper.courseId,
            courseCode: course.code,
            courseTitle: course.title,
            examType: pastPaper.examType,
            slot: pastPaper.slot,
            year: pastPaper.year,
            hasAnswerKey: pastPaper.hasAnswerKey,
            createdAt: pastPaper.createdAt,
        })
        .from(pastPaper)
        .leftJoin(course, eq(pastPaper.courseId, course.id))
        .where(
            and(
                ne(pastPaper.id, parsed.excludePaperId),
                or(
                    eq(pastPaper.id, extractedPaperId),
                    ilike(pastPaper.title, pattern),
                    ilike(course.code, pattern),
                    ilike(course.title, pattern),
                ),
            ),
        )
        .orderBy(desc(pastPaper.createdAt))
        .limit(25);

    return rows
        .map((row) => ({
            id: row.id,
            title: row.title,
            courseId: row.courseId,
            courseCode: row.courseCode,
            courseTitle: row.courseTitle,
            examType: row.examType,
            slot: row.slot,
            year: row.year,
            hasAnswerKey: row.hasAnswerKey,
            createdAt: row.createdAt,
        }))
        .sort((left, right) => {
            const leftScore = scoreResult(left, {
                query: parsed.query,
                extractedPaperId,
                courseId: parsed.courseId ?? null,
            });
            const rightScore = scoreResult(right, {
                query: parsed.query,
                extractedPaperId,
                courseId: parsed.courseId ?? null,
            });
            return (
                rightScore - leftScore ||
                right.createdAt.getTime() - left.createdAt.getTime() ||
                left.id.localeCompare(right.id)
            );
        })
        .slice(0, limit)
        .map(({ courseId: _ignoredCourseId, createdAt: _ignoredCreatedAt, ...result }) => result);
}
