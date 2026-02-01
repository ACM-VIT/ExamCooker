"use server";

import { PrismaClient } from "@/src/generated/prisma";
import { auth } from "../auth";
import { revalidatePath, revalidateTag } from "next/cache";

const prisma = new PrismaClient();

async function findOrCreateTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error("Invalid tag name");
    }

    const existing = await prisma.tag.findFirst({
        where: { name: { equals: trimmed, mode: "insensitive" } },
    });

    if (existing) return existing;

    return prisma.tag.create({ data: { name: trimmed } });
}

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

    // @ts-ignore
    if (session?.user?.role !== "MODERATOR") {
        throw new Error("Access denied");
    }

    const cleanedTags = normalizeTags(tags);
    const tagRecords = await Promise.all(
        cleanedTags.map((tag) => findOrCreateTag(tag))
    );

    await prisma.pastPaper.update({
        where: { id: paperId },
        data: {
            tags: {
                set: tagRecords.map((tag) => ({ id: tag.id })),
            },
        },
    });

    revalidateTag("past_papers", "minutes");
    revalidateTag(`past_paper:${paperId}`, "minutes");
    revalidatePath(`/past_papers/${paperId}`);

    return { success: true };
}
