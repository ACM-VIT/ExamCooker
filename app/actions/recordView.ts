"use server";

import { auth } from "@/app/auth";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export type ViewableItemType = "pastpaper" | "note" | "forumpost" | "subject" | "syllabus";

export async function recordViewAction(type: ViewableItemType, itemId: string) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false };

    switch (type) {
        case "pastpaper":
            await prisma.viewHistory.upsert({
                where: { userId_pastPaperId: { userId, pastPaperId: itemId } },
                update: { viewedAt: new Date(), count: { increment: 1 } },
                create: { userId, pastPaperId: itemId, viewedAt: new Date() },
            });
            break;
        case "note":
            await prisma.viewHistory.upsert({
                where: { userId_noteId: { userId, noteId: itemId } },
                update: { viewedAt: new Date(), count: { increment: 1 } },
                create: { userId, noteId: itemId, viewedAt: new Date() },
            });
            break;
        case "forumpost":
            await prisma.viewHistory.upsert({
                where: { userId_forumPostId: { userId, forumPostId: itemId } },
                update: { viewedAt: new Date(), count: { increment: 1 } },
                create: { userId, forumPostId: itemId, viewedAt: new Date() },
            });
            break;
        case "subject":
            await prisma.viewHistory.upsert({
                where: { userId_subjectId: { userId, subjectId: itemId } },
                update: { viewedAt: new Date(), count: { increment: 1 } },
                create: { userId, subjectId: itemId, viewedAt: new Date() },
            });
            break;
        case "syllabus":
            await prisma.viewHistory.upsert({
                where: { userId_syllabusId: { userId, syllabusId: itemId } },
                update: { viewedAt: new Date(), count: { increment: 1 } },
                create: { userId, syllabusId: itemId, viewedAt: new Date() },
            });
            break;
        default:
            break;
    }

    revalidateTag("home", "minutes");
    revalidateTag(`home:${userId}`, "minutes");
    return { success: true };
}
