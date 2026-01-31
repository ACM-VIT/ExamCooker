import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";

export async function getPastPaperDetail(id: string) {
    "use cache";
    cacheTag("past_papers");
    cacheTag(`past_paper:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return prisma.pastPaper.findUnique({
        where: { id },
        include: {
            author: true,
            tags: true,
        },
    });
}
