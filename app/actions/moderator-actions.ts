"use server";

import { and, count, desc, eq, getTableColumns, ilike, isNull, ne, sql } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { normalizeGcsUrl } from "@/lib/normalize-gcs-url";
import { generatePastPaperTitleFromPdf } from "@/lib/ai/past-paper-title";
import { course, db, note, pastPaper, user } from "@/db";

export async function fetchUnclearedItems() {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const noteColumns = getTableColumns(note);
    const pastPaperColumns = getTableColumns(pastPaper);

    const [notes, pastPapers, totalRows] = await Promise.all([
        db
            .select(noteColumns)
            .from(note)
            .where(eq(note.isClear, false))
            .orderBy(desc(note.createdAt)),
        db
            .select({
                ...pastPaperColumns,
                courseCode: course.code,
                courseTitle: course.title,
            })
            .from(pastPaper)
            .leftJoin(course, eq(pastPaper.courseId, course.id))
            .where(eq(pastPaper.isClear, false))
            .orderBy(desc(pastPaper.createdAt)),
        db.select({ total: count() }).from(user),
    ]);

    const totalUsers = totalRows[0]?.total ?? 0;

    return {
        notes: notes.map((note) => ({
            ...note,
            fileUrl: normalizeGcsUrl(note.fileUrl) ?? note.fileUrl,
            thumbNailUrl: normalizeGcsUrl(note.thumbNailUrl) ?? note.thumbNailUrl,
        })),
        pastPapers: pastPapers.map((paper) => ({
            ...paper,
            fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
            thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
            course:
                paper.courseCode && paper.courseTitle
                    ? {
                        code: paper.courseCode,
                        title: paper.courseTitle,
                    }
                    : null,
        })),
        totalUsers,
    };
}

export async function approveItem(
    id: string,
    type: "note" | "pastPaper",
    options?: { allowDuplicate?: boolean },
) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const allowDuplicate = options?.allowDuplicate ?? false;

    if (type === "note") {
        await db.update(note).set({ isClear: true }).where(eq(note.id, id));
    } else {
        const paperRows = await db
            .select({
                title: pastPaper.title,
                fileUrl: pastPaper.fileUrl,
                courseId: pastPaper.courseId,
                examType: pastPaper.examType,
                slot: pastPaper.slot,
                year: pastPaper.year,
                semester: pastPaper.semester,
                campus: pastPaper.campus,
                hasAnswerKey: pastPaper.hasAnswerKey,
            })
            .from(pastPaper)
            .where(eq(pastPaper.id, id))
            .limit(1);

        const paper = paperRows[0];
        if (!paper) throw new Error("Past paper not found");

        if (!allowDuplicate) {
            const fileDuplicateRows = await db
                .select({
                    id: pastPaper.id,
                    title: pastPaper.title,
                })
                .from(pastPaper)
                .where(and(ne(pastPaper.id, id), eq(pastPaper.fileUrl, paper.fileUrl)))
                .limit(1);

            const fileDuplicate = fileDuplicateRows[0];
            if (fileDuplicate) {
                return {
                    status: "duplicate" as const,
                    duplicateId: fileDuplicate.id,
                    duplicateTitle: fileDuplicate.title,
                };
            }

            if (paper.courseId && paper.examType && paper.year) {
                const structuredDuplicateRows = await db
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                    })
                    .from(pastPaper)
                    .where(
                        and(
                            ne(pastPaper.id, id),
                            eq(pastPaper.courseId, paper.courseId),
                            eq(pastPaper.examType, paper.examType),
                            eq(pastPaper.year, paper.year),
                            paper.slot === null
                                ? isNull(pastPaper.slot)
                                : eq(pastPaper.slot, paper.slot),
                            eq(pastPaper.semester, paper.semester),
                            eq(pastPaper.campus, paper.campus),
                            eq(pastPaper.hasAnswerKey, paper.hasAnswerKey),
                        ),
                    )
                    .limit(1);

                const structuredDuplicate = structuredDuplicateRows[0];
                if (structuredDuplicate) {
                    return {
                        status: "duplicate" as const,
                        duplicateId: structuredDuplicate.id,
                        duplicateTitle: structuredDuplicate.title,
                    };
                }
            } else {
                const exactTitleDuplicateRows = await db
                    .select({
                        id: pastPaper.id,
                        title: pastPaper.title,
                    })
                    .from(pastPaper)
                    .where(
                        and(
                            ne(pastPaper.id, id),
                            sql`lower(${pastPaper.title}) = lower(${paper.title})`,
                        ),
                    )
                    .limit(1);

                const exactTitleDuplicate = exactTitleDuplicateRows[0];
                if (exactTitleDuplicate) {
                    return {
                        status: "duplicate" as const,
                        duplicateId: exactTitleDuplicate.id,
                        duplicateTitle: exactTitleDuplicate.title,
                    };
                }
            }
        }

        await db.update(pastPaper).set({ isClear: true }).where(eq(pastPaper.id, id));
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");

    return { status: "approved" as const };
}

export async function renameItem(id: string, type: "note" | "pastPaper", title: string) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") {
        await db.update(note).set({ title }).where(eq(note.id, id));
    }
    if (type === "pastPaper") {
        await db.update(pastPaper).set({ title }).where(eq(pastPaper.id, id));
    }

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
    if (type === "pastPaper") {
        revalidatePath(`/past_papers/${id}`);
        revalidateTag(`past_paper:${id}`, "minutes");
    }
}

export async function deleteItem(id: string, type: "note" | "pastPaper") {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    if (type === "note") await db.delete(note).where(eq(note.id, id));
    if (type === "pastPaper") await db.delete(pastPaper).where(eq(pastPaper.id, id));

    revalidatePath("/mod");
    revalidateTag("notes", "minutes");
    revalidateTag("past_papers", "minutes");
}

export async function generatePastPaperTitle(id: string) {
    const session = await auth();
    if (session?.user?.role !== "MODERATOR") throw new Error("Access denied");

    const rows = await db
        .select({
            title: pastPaper.title,
            fileUrl: pastPaper.fileUrl,
        })
        .from(pastPaper)
        .where(eq(pastPaper.id, id))
        .limit(1);

    const paper = rows[0];
    if (!paper) throw new Error("Past paper not found");

    const fileUrl = normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl;
    const aiTitle = await generatePastPaperTitleFromPdf({ fileUrl, fallbackTitle: paper.title });

    if (aiTitle && aiTitle !== paper.title) {
        await db.update(pastPaper).set({ title: aiTitle }).where(eq(pastPaper.id, id));
    }

    revalidatePath("/mod");
    revalidateTag("past_papers", "minutes");

    return { title: aiTitle };
}
