import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";
import { normalizeGcsUrl } from "@/lib/normalizeGcsUrl";

export async function getPastPaperDetail(id: string) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    const paper = await prisma.pastPaper.findUnique({
        where: { id },
        include: {
            author: true,
            tags: true,
        },
    });

    if (!paper) return null;

    return {
        ...paper,
        fileUrl: normalizeGcsUrl(paper.fileUrl) ?? paper.fileUrl,
        thumbNailUrl: normalizeGcsUrl(paper.thumbNailUrl) ?? paper.thumbNailUrl,
    };
}
