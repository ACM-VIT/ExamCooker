import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";

export async function getNoteDetail(id: string) {
    "use cache";
    cacheTag("notes");
    cacheTag(`note:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return prisma.note.findUnique({
        where: { id },
        include: {
            author: true,
            tags: true,
        },
    });
}
