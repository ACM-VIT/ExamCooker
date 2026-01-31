import { cacheLife, cacheTag } from "next/cache";
import prisma from "@/lib/prisma";

export async function getSyllabusDetail(id: string) {
    "use cache";
    cacheTag("syllabus");
    cacheTag(`syllabus:${id}`);
    cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

    return prisma.syllabi.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            fileUrl: true,
        },
    });
}
