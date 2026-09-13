"use server";

import { appendFileSync } from "node:fs";
import { asc, count, eq, ilike, isNotNull, or } from "drizzle-orm";
import { updateTag, revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/app/auth";
import { course, db, note, pastPaper, subject, syllabi } from "@/db";
import { invalidatePastPapersSurfaceCache } from "@/lib/cache/past-papers-surface-cache";
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

function replaceSyllabusCodePrefix(name: string, currentCode: string, nextCode: string) {
    const prefix = `${currentCode}_`;
    if (!name.toUpperCase().startsWith(prefix.toUpperCase())) return null;
    return `${nextCode}${name.slice(currentCode.length)}`;
}

function replaceSubjectCodePrefix(name: string, currentCode: string, nextCode: string) {
    const upperName = name.toUpperCase();
    const upperCode = currentCode.toUpperCase();
    if (upperName === upperCode) return nextCode;
    if (!upperName.startsWith(upperCode)) return null;

    const suffix = name.slice(currentCode.length);
    return suffix.startsWith("-") || suffix.startsWith(" -")
        ? `${nextCode}${suffix}`
        : null;
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

    // #region agent log
    appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H3", location: "app/actions/manage-courses.ts:updateManagedCourse:entry", message: "Validated course rename request", data: { courseId, requestedCode: validated.data.code }, timestamp: Date.now() }) + "\n");
    // #endregion

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
                const syllabusRows = await tx
                    .select({ id: syllabi.id, name: syllabi.name })
                    .from(syllabi)
                    .where(ilike(syllabi.name, `${existing.code}_%`));
                const destinationSyllabusRows = await tx
                    .select({ id: syllabi.id, name: syllabi.name })
                    .from(syllabi)
                    .where(ilike(syllabi.name, `${validated.data.code}_%`));

                // #region agent log
                appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H1,H4", location: "app/actions/manage-courses.ts:updateManagedCourse:syllabusRows", message: "Loaded source and destination syllabus prefix rows", data: { existingCode: existing.code, nextCode: validated.data.code, sourceRows: syllabusRows, destinationRows: destinationSyllabusRows, exactDestinationRows: destinationSyllabusRows.filter((row) => replaceSyllabusCodePrefix(row.name, validated.data.code, validated.data.code) !== null) }, timestamp: Date.now() }) + "\n");
                // #endregion

                for (const syllabusRow of syllabusRows) {
                    const nextName = replaceSyllabusCodePrefix(
                        syllabusRow.name,
                        existing.code,
                        validated.data.code,
                    );
                    if (!nextName) continue;
                    await tx
                        .update(syllabi)
                        .set({ name: nextName })
                        .where(eq(syllabi.id, syllabusRow.id));
                    // #region agent log
                    appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H1", location: "app/actions/manage-courses.ts:updateManagedCourse:syllabusUpdate", message: "Renamed source syllabus row", data: { id: syllabusRow.id, previousName: syllabusRow.name, nextName }, timestamp: Date.now() }) + "\n");
                    // #endregion
                }

                const subjectRows = await tx
                    .select({ id: subject.id, name: subject.name })
                    .from(subject)
                    .where(
                        or(
                            ilike(subject.name, `${existing.code} -%`),
                            ilike(subject.name, `${existing.code}-%`),
                            ilike(subject.name, existing.code),
                        ),
                    );
                const destinationSubjectRows = await tx
                    .select({ id: subject.id, name: subject.name })
                    .from(subject)
                    .where(
                        or(
                            ilike(subject.name, `${validated.data.code} -%`),
                            ilike(subject.name, `${validated.data.code}-%`),
                            ilike(subject.name, validated.data.code),
                        ),
                    );

                // #region agent log
                appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H2,H4", location: "app/actions/manage-courses.ts:updateManagedCourse:subjectRows", message: "Loaded source and destination subject prefix rows", data: { existingCode: existing.code, nextCode: validated.data.code, sourceRows: subjectRows, destinationRows: destinationSubjectRows, exactDestinationRows: destinationSubjectRows.filter((row) => replaceSubjectCodePrefix(row.name, validated.data.code, validated.data.code) !== null) }, timestamp: Date.now() }) + "\n");
                // #endregion

                for (const subjectRow of subjectRows) {
                    const nextName = replaceSubjectCodePrefix(
                        subjectRow.name,
                        existing.code,
                        validated.data.code,
                    );
                    if (!nextName) continue;
                    await tx
                        .update(subject)
                        .set({ name: nextName })
                        .where(eq(subject.id, subjectRow.id));
                    // #region agent log
                    appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H2", location: "app/actions/manage-courses.ts:updateManagedCourse:subjectUpdate", message: "Renamed source subject row", data: { id: subjectRow.id, previousName: subjectRow.name, nextName }, timestamp: Date.now() }) + "\n");
                    // #endregion
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
        // #region agent log
        appendFileSync("/opt/cursor/logs/debug.log", JSON.stringify({ hypothesisId: "H3", location: "app/actions/manage-courses.ts:updateManagedCourse:transactionExit", message: "Course rename transaction completed", data: { courseId, requestedCode: validated.data.code, updated }, timestamp: Date.now() }) + "\n");
        // #endregion
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
