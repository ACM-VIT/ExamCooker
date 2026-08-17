"use server";

import { asc, count, eq, isNotNull } from "drizzle-orm";
import { updateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/auth";
import { course, db, note, pastPaper, subject, syllabi } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
import {
    replaceOwnedSubjectCodePrefix,
    replaceOwnedSyllabusCodePrefix,
} from "@/lib/course-code-owned-prefix";
import { normalizeCourseCode } from "@/lib/course-tags";

const courseInputSchema = z.object({
    code: z.string().trim().min(2).max(40),
    title: z.string().trim().min(2).max(160),
    aliases: z.array(z.string().trim().min(1).max(120)).max(24),
});

export type ModeratorCourseRecord = {
    id: string;
    code: string;
    title: string;
    aliases: string[];
    livePaperCount: number;
    pendingPaperCount: number;
    liveNoteCount: number;
    pendingNoteCount: number;
    createdAt: string;
    updatedAt: string;
};

export type CourseMutationResult =
    | { success: true; course: ModeratorCourseRecord }
    | { success: false; error: string };

type CourseInput = z.input<typeof courseInputSchema>;

async function requireModerator() {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }
}

function normalizeAliases(title: string, aliases: string[]) {
    const values = [title, ...aliases]
        .map((alias) => alias.trim().replace(/\s+/g, " "))
        .filter(Boolean);
    const seen = new Set<string>();

    return values.filter((alias) => {
        const key = alias.toLocaleLowerCase("en");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function validateCourseInput(input: CourseInput) {
    const parsed = courseInputSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: "Check the course code, title, and aliases." };
    }

    const code = normalizeCourseCode(parsed.data.code);
    if (!/^[A-Z0-9][A-Z0-9/._-]*$/.test(code)) {
        return {
            success: false as const,
            error: "Course codes can only use letters, numbers, /, ., _ and -.",
        };
    }

    return {
        success: true as const,
        data: {
            code,
            title: parsed.data.title,
            aliases: normalizeAliases(parsed.data.title, parsed.data.aliases),
        },
    };
}

function countKey(courseId: string, isClear: boolean) {
    return `${courseId}:${isClear ? "live" : "pending"}`;
}

async function loadModeratorCourseRecords(): Promise<ModeratorCourseRecord[]> {
    const [courseRows, noteCountRows, paperCountRows] = await Promise.all([
        db
            .select({
                id: course.id,
                code: course.code,
                title: course.title,
                aliases: course.aliases,
                createdAt: course.createdAt,
                updatedAt: course.updatedAt,
            })
            .from(course)
            .orderBy(asc(course.code)),
        db
            .select({
                courseId: note.courseId,
                isClear: note.isClear,
                total: count(),
            })
            .from(note)
            .where(isNotNull(note.courseId))
            .groupBy(note.courseId, note.isClear),
        db
            .select({
                courseId: pastPaper.courseId,
                isClear: pastPaper.isClear,
                total: count(),
            })
            .from(pastPaper)
            .where(isNotNull(pastPaper.courseId))
            .groupBy(pastPaper.courseId, pastPaper.isClear),
    ]);

    const noteCounts = new Map(
        noteCountRows
            .filter((row) => row.courseId !== null)
            .map((row) => [countKey(row.courseId!, row.isClear), Number(row.total)]),
    );
    const paperCounts = new Map(
        paperCountRows
            .filter((row) => row.courseId !== null)
            .map((row) => [countKey(row.courseId!, row.isClear), Number(row.total)]),
    );

    return courseRows.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        aliases: row.aliases ?? [],
        livePaperCount: paperCounts.get(countKey(row.id, true)) ?? 0,
        pendingPaperCount: paperCounts.get(countKey(row.id, false)) ?? 0,
        liveNoteCount: noteCounts.get(countKey(row.id, true)) ?? 0,
        pendingNoteCount: noteCounts.get(countKey(row.id, false)) ?? 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }));
}

async function invalidateCourseRegistry() {
    updateTag("courses");
    revalidatePath("/mod/courses");
    await invalidatePastPapersSurfaceCache();
}

function isUniqueViolation(error: unknown) {
    return Boolean(
        error &&
            typeof error === "object" &&
            "code" in error &&
            (error as { code?: string }).code === "23505",
    );
}

export async function getModeratorCourseRegistry() {
    await requireModerator();
    return loadModeratorCourseRecords();
}

export async function createManagedCourse(input: CourseInput): Promise<CourseMutationResult> {
    await requireModerator();
    const validated = validateCourseInput(input);
    if (!validated.success) return validated;

    try {
        const [created] = await db
            .insert(course)
            .values(validated.data)
            .returning({ id: course.id });
        if (!created) return { success: false, error: "The course could not be created." };

        await invalidateCourseRegistry();
        const record = (await loadModeratorCourseRecords()).find(
            (entry) => entry.id === created.id,
        );
        return record
            ? { success: true, course: record }
            : { success: false, error: "Created, but the course could not be reloaded." };
    } catch (error) {
        if (isUniqueViolation(error)) {
            return { success: false, error: `A course with code ${validated.data.code} already exists.` };
        }
        return { success: false, error: "The course could not be created." };
    }
}

export async function updateManagedCourse(
    courseId: string,
    input: CourseInput,
): Promise<CourseMutationResult> {
    await requireModerator();
    if (!z.string().trim().min(1).max(64).safeParse(courseId).success) {
        return { success: false, error: "Invalid course identifier." };
    }

    const validated = validateCourseInput(input);
    if (!validated.success) return validated;

    try {
        const updated = await db.transaction(async (tx) => {
            const [existing] = await tx
                .select({ code: course.code })
                .from(course)
                .where(eq(course.id, courseId))
                .limit(1);
            if (!existing) return null;

            const codeChanged = existing.code !== validated.data.code;
            if (codeChanged) {
                const courseCodeRows = await tx
                    .select({ code: course.code })
                    .from(course);
                const knownCourseCodes = courseCodeRows.map((row) => row.code);
                const syllabusRows = await tx
                    .select({ id: syllabi.id, name: syllabi.name })
                    .from(syllabi);

                for (const syllabusRow of syllabusRows) {
                    const nextName = replaceOwnedSyllabusCodePrefix({
                        name: syllabusRow.name,
                        currentCode: existing.code,
                        nextCode: validated.data.code,
                        knownCourseCodes,
                    });
                    if (!nextName) continue;
                    await tx
                        .update(syllabi)
                        .set({ name: nextName })
                        .where(eq(syllabi.id, syllabusRow.id));
                }

                const subjectRows = await tx
                    .select({ id: subject.id, name: subject.name })
                    .from(subject);

                for (const subjectRow of subjectRows) {
                    const nextName = replaceOwnedSubjectCodePrefix({
                        name: subjectRow.name,
                        currentCode: existing.code,
                        nextCode: validated.data.code,
                        knownCourseCodes,
                    });
                    if (!nextName) continue;
                    await tx
                        .update(subject)
                        .set({ name: nextName })
                        .where(eq(subject.id, subjectRow.id));
                }
            }

            const [updated] = await tx
                .update(course)
                .set({ ...validated.data, updatedAt: new Date() })
                .where(eq(course.id, courseId))
                .returning({ id: course.id });

            return updated
                ? { id: updated.id, codeChanged }
                : null;
        });
        if (!updated) return { success: false, error: "Course not found." };

        if (updated.codeChanged) {
            updateTag("syllabus");
            updateTag("resources");
        }
        await invalidateCourseRegistry();
        const record = (await loadModeratorCourseRecords()).find(
            (entry) => entry.id === updated.id,
        );
        return record
            ? { success: true, course: record }
            : { success: false, error: "Saved, but the course could not be reloaded." };
    } catch (error) {
        if (isUniqueViolation(error)) {
            return {
                success: false,
                error: `The code ${validated.data.code} is already used by a course or linked resource.`,
            };
        }
        return { success: false, error: "The course could not be saved." };
    }
}
