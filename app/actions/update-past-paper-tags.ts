"use server";

import { eq } from "drizzle-orm";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { db, pastPaperToTag } from "@/db";
import { findOrCreateTag } from "@/db/helpers";

function normalizeTags(tags: string[]) {
    const map = new Map<string, string>();
    for (const tag of tags) {
        const cleaned = tag.trim().replace(/\s+/g, " ");
        if (!cleaned) continue;
        const key = cleaned.toLowerCase();
        if (!map.has(key)) {
            map.set(key, cleaned);
        }
    }
    return Array.from(map.values());
}

export async function updatePastPaperTags(paperId: string, tags: string[]) {
    const session = await auth();

    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const cleanedTags = normalizeTags(tags);
    const tagRecords = await Promise.all(
        cleanedTags.map((tag) => findOrCreateTag(tag, { caseInsensitive: true })),
    );

    await db.delete(pastPaperToTag).where(eq(pastPaperToTag.a, paperId));
    if (tagRecords.length > 0) {
        await db.insert(pastPaperToTag).values(
            tagRecords.map((tag) => ({
                a: paperId,
                b: tag.id,
            })),
        );
    }

    revalidateTag("past_papers", "minutes");
    revalidateTag(`past_paper:${paperId}`, "minutes");
    revalidatePath(`/past_papers/${paperId}`);

    return { success: true };
}
