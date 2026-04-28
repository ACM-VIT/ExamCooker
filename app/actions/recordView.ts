"use server";

import { auth } from "@/app/auth";
import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db, viewHistory } from "@/src/db";

export type ViewableItemType = "pastpaper" | "note" | "forumpost" | "subject" | "syllabus";

function upsertViewHistory(
    values:
        | { userId: string; pastPaperId: string; viewedAt: Date }
        | { userId: string; noteId: string; viewedAt: Date }
        | { userId: string; forumPostId: string; viewedAt: Date }
        | { userId: string; subjectId: string; viewedAt: Date }
        | { userId: string; syllabusId: string; viewedAt: Date },
    target:
        | [typeof viewHistory.userId, typeof viewHistory.pastPaperId]
        | [typeof viewHistory.userId, typeof viewHistory.noteId]
        | [typeof viewHistory.userId, typeof viewHistory.forumPostId]
        | [typeof viewHistory.userId, typeof viewHistory.subjectId]
        | [typeof viewHistory.userId, typeof viewHistory.syllabusId],
) {
    return db
        .insert(viewHistory)
        .values(values)
        .onConflictDoUpdate({
            target,
            set: {
                viewedAt: new Date(),
                count: sql`${viewHistory.count} + 1`,
            },
        });
}

export async function recordViewAction(type: ViewableItemType, itemId: string) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false };

    const viewedAt = new Date();
    switch (type) {
        case "pastpaper":
            await upsertViewHistory(
                { userId, pastPaperId: itemId, viewedAt },
                [viewHistory.userId, viewHistory.pastPaperId],
            );
            break;
        case "note":
            await upsertViewHistory(
                { userId, noteId: itemId, viewedAt },
                [viewHistory.userId, viewHistory.noteId],
            );
            break;
        case "forumpost":
            await upsertViewHistory(
                { userId, forumPostId: itemId, viewedAt },
                [viewHistory.userId, viewHistory.forumPostId],
            );
            break;
        case "subject":
            await upsertViewHistory(
                { userId, subjectId: itemId, viewedAt },
                [viewHistory.userId, viewHistory.subjectId],
            );
            break;
        case "syllabus":
            await upsertViewHistory(
                { userId, syllabusId: itemId, viewedAt },
                [viewHistory.userId, viewHistory.syllabusId],
            );
            break;
        default:
            break;
    }

    revalidateTag("home", "minutes");
    revalidateTag(`home:${userId}`, "minutes");
    return { success: true };
}
